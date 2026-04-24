# 모의 암호화폐 투자 플랫폼

실시간 Binance 시세를 기반으로 한 암호화폐 모의 투자 서비스입니다.  
사용자는 회원가입 후 1,000만 원의 가상 자산을 지급받아 16개 암호화폐를 자유롭게 매수/매도할 수 있습니다.

**배포 URL:** https://squeeze-cubbyhole-antelope.ngrok-free.dev  
**GitHub:** https://github.com/jeongws032700-source/mock-invest

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 수행 주제 | 실시간 Binance WebSocket 시세 기반 암호화폐 모의 투자 플랫폼 |
| 금융 도메인 | 가상화폐 모의 투자 — 잔고 관리, 매수/매도, 포트폴리오 조회 |
| 사용 기술 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, TanStack Query v5, Zustand v5, MariaDB, JWT, GCP VM, ngrok |

### 주요 기능

- **실시간 시세** — Binance WebSocket으로 16개 코인 가격 실시간 수신 및 플래시 애니메이션
- **OHLCV 차트** — Binance REST API로 실제 캔들 데이터 조회 (1m ~ 1W 타임프레임)
- **매수/매도** — 잔고 검증 → 보유량 업데이트 → 거래 기록 저장 원자적 처리
- **포트폴리오** — 보유 코인별 평균단가·수익률 실시간 계산
- **거래 내역** — 최근 20건 조회
- **JWT 인증** — httpOnly 쿠키 기반 7일 세션, 미들웨어 라우트 보호

---

## 2. 백엔드 구성 및 라우팅

**구현 방식:** Next.js Route Handlers (`app/api/...`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 (bcrypt 해시, JWT 발급) |
| POST | `/api/auth/login` | 로그인 (비밀번호 검증, JWT 발급) |
| POST | `/api/auth/logout` | 로그아웃 (쿠키 삭제) |
| GET | `/api/me` | 내 정보 조회 (잔고, 보유 코인, 거래 내역) |
| POST | `/api/trade` | 매수/매도 처리 |
| GET | `/api/market` | 외부 시세 프록시 (ISR 60초 캐시) |

**미들웨어 인증 (`proxy.ts`):**  
`/dashboard` 경로 접근 시 JWT를 `jose`로 검증하여 미인증 사용자를 `/login`으로 리다이렉트합니다.

---

## 3. 데이터베이스 및 SQL 활용

**MariaDB 테이블 구조 (스키마 자동 생성):**

```sql
-- 사용자
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  balance      DECIMAL(18,2) NOT NULL DEFAULT 10000000.00,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 보유 코인
CREATE TABLE holdings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  coin_id    VARCHAR(32) NOT NULL,
  coin_name  VARCHAR(100) NOT NULL,
  amount     DECIMAL(24,8) NOT NULL DEFAULT 0,
  avg_price  DECIMAL(18,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (user_id, coin_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 거래 내역
CREATE TABLE trades (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  coin_id   VARCHAR(32) NOT NULL,
  coin_name VARCHAR(100) NOT NULL,
  type      ENUM('buy','sell') NOT NULL,
  amount    DECIMAL(24,8) NOT NULL,
  price     DECIMAL(18,8) NOT NULL,
  total     DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**주요 SQL 쿼리:**

```sql
-- CREATE: 회원가입
INSERT INTO users (email, password_hash, balance) VALUES (?, ?, 10000000);

-- CREATE: 매수 신규 보유
INSERT INTO holdings (user_id, coin_id, coin_name, amount, avg_price) VALUES (?, ?, ?, ?, ?);

-- READ: 포트폴리오 조회
SELECT id, email, balance FROM users WHERE id = ?;
SELECT coin_id, amount, avg_price FROM holdings WHERE user_id = ?;
SELECT coin_id, type, amount, price, total, created_at
  FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 20;

-- UPDATE: 매수 시 평균단가 재계산
UPDATE holdings SET amount = ?, avg_price = ? WHERE user_id = ? AND coin_id = ?;
UPDATE users SET balance = balance - ? WHERE id = ?;

-- UPDATE: 매도 시 잔고 증가
UPDATE holdings SET amount = ? WHERE user_id = ? AND coin_id = ?;
UPDATE users SET balance = balance + ? WHERE id = ?;

-- DELETE: 보유량 0 이하 시 포지션 정리
DELETE FROM holdings WHERE user_id = ? AND coin_id = ?;

-- CREATE: 거래 기록 저장
INSERT INTO trades (user_id, coin_id, coin_name, type, amount, price, total) VALUES (?, ?, ?, ?, ?, ?, ?);
```

---

## 4. 프론트엔드 상태 관리 및 데이터 최적화

### Zustand — 전역 실시간 가격 상태

```ts
// lib/priceStore.ts
export const usePriceStore = create<PriceStore>(set => ({
  prices: {},
  setPrice: (sym, data) => set(state => ({
    prices: { ...state.prices, [sym]: data },
  })),
}));
```

Binance WebSocket 틱 수신 시 `setPrice`로 전역 스토어를 업데이트하고, Watchlist·차트·포트폴리오 등 모든 컴포넌트가 동일한 가격 소스를 구독합니다.

### TanStack Query — 서버 상태 관리

```ts
// 내 정보 30초 자동 갱신
const { data: me } = useQuery<MeData>({
  queryKey: ['me'],
  queryFn: () => fetch('/api/me').then(r => r.json()),
  refetchInterval: 30_000,
});

// OHLCV 캔들 데이터 (타임프레임·심볼 변경 시 자동 재조회)
const { data: klines } = useQuery({
  queryKey: ['klines', selectedSym, tf],
  queryFn: async () => { /* Binance REST */ },
  staleTime: 30_000,
});

// 매수/매도 후 포트폴리오 자동 무효화
const trade = useMutation({
  mutationFn: (body) => fetch('/api/trade', { method: 'POST', body: JSON.stringify(body) }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
});
```

### Next.js ISR — 외부 API 캐싱

```ts
// app/api/market/route.ts
fetch('https://api.coingecko.com/api/v3/simple/price...', {
  next: { revalidate: 60 }  // 60초 ISR 캐시
})
```

CoinGecko rate limit 방지를 위해 Next.js의 fetch 캐싱(ISR)을 적용했습니다.

---

## 5. 인프라 및 배포

| 구성 요소 | 내용 |
|-----------|------|
| **서버** | GCP VM (Ubuntu, Linux 6.8.0-1048-gcp) |
| **런타임** | Node.js + Next.js dev server (port 3000) |
| **외부 노출** | ngrok 고정 도메인 (HTTPS 자동 적용) |
| **DB** | MariaDB (localhost, `mock_invest` DB) |
| **인증** | JWT (jsonwebtoken) + jose (미들웨어 전용) |

---

## 6. 트러블슈팅

### 1. Next.js 미들웨어에서 `jsonwebtoken` 사용 불가

**문제:** `proxy.ts` 미들웨어에서 `jsonwebtoken`으로 JWT 검증 시 `Cannot read properties of undefined` 에러 발생.

**원인:** Next.js 미들웨어는 Edge Runtime에서 실행되는데, `jsonwebtoken`은 Node.js 전용 모듈(`crypto`, `Buffer` 등)에 의존하여 Edge 환경에서 동작하지 않음.

**해결:** 미들웨어에서는 Web Crypto API 기반의 `jose` 라이브러리로 교체하고, Route Handlers에서는 기존 `jsonwebtoken`을 유지하는 방식으로 분리.

```ts
// 미들웨어 (Edge) → jose
import { jwtVerify } from 'jose';
await jwtVerify(token, new TextEncoder().encode(secret));

// Route Handler (Node.js) → jsonwebtoken
import jwt from 'jsonwebtoken';
jwt.verify(token, secret);
```

---

### 2. WebSocket 실시간 업데이트 시 마지막 캔들 불일치

**문제:** Binance WebSocket 틱으로 현재가를 업데이트하면 REST API로 받은 OHLCV 캔들의 종가와 괴리가 발생하여 차트가 부자연스럽게 표시됨.

**원인:** REST API 캔들 데이터는 최대 수 초 지연이 있고, WebSocket은 밀리초 단위로 갱신되어 마지막 캔들의 종가(close)가 일치하지 않음.

**해결:** WebSocket 틱 수신 시 마지막 캔들의 `close` 값을 현재 실시간 가격으로 덮어쓰는 방식으로 처리하여 차트와 현재가를 일치시킴.

---

### 3. 매수/매도 직후 포트폴리오 미갱신

**문제:** 거래 완료 후 화면의 잔고와 보유 코인 수량이 즉시 반영되지 않음.

**원인:** React Query가 `['me']` 쿼리를 30초 stale time 동안 캐시로 유지하여 서버에 재요청하지 않음.

**해결:** `useMutation`의 `onSuccess` 콜백에서 `queryClient.invalidateQueries({ queryKey: ['me'] })`를 호출하여 거래 직후 강제 재조회.
