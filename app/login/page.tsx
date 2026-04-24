'use client';
import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import s from './login.module.css';
import { WATCHLIST } from '@/lib/market-data';

/* ── Static candle data (seeded so SSR and client match) ── */
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 >>> 0; return s / 0x100000000; };
}
function makeCandles(n: number) {
  const r = seededRand(42);
  let price = 61000;
  return Array.from({ length: n }, () => {
    const open  = price;
    const close = Math.max(55000, Math.min(68000, open + (r() - 0.46) * 800));
    const high  = Math.max(open, close) + r() * 300;
    const low   = Math.min(open, close) - r() * 300;
    price = close;
    return { o: open, c: close, h: high, l: low };
  });
}
const CANDLES = makeCandles(60);

const MINI_TICKERS = WATCHLIST.slice(0, 6).map(c => ({
  pair: `${c.sym}/USD`,
  price: c.price,
  chg: c.chgPct,
  up: c.chgPct >= 0,
}));

const MARKET_ROWS = WATCHLIST.slice(0, 6).map(c => ({
  pair: `${c.sym}/USD`,
  price: c.price >= 1000
    ? '$' + c.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '$' + c.price.toLocaleString('en-US', { maximumFractionDigits: 4 }),
  vol: c.vol24 >= 1e9
    ? '$' + (c.vol24 / 1e9).toFixed(1) + 'B'
    : '$' + (c.vol24 / 1e6).toFixed(0) + 'M',
  up: c.chgPct >= 0,
}));

/* ── Chart helpers ── */
const W = 700, H = 280;
function mapY(v: number, mn: number, mx: number) {
  return H - ((v - mn) / (mx - mn)) * (H * 0.85) - H * 0.05;
}

type Tab = 'signin' | 'register';

/* ── Inner component (uses useSearchParams) ── */
function LoginInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const defaultTab   = searchParams.get('tab') === 'register' ? 'register' : 'signin';

  const [tab,        setTab]       = useState<Tab>(defaultTab as Tab);
  const [showPw,     setShowPw]    = useState(false);
  const [remember,   setRemember]  = useState(true);
  const [pw,         setPw]        = useState('');
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState('');
  const [theme,      setTheme]     = useState('');
  const [showTweaks, setShowTweaks]= useState(false);

  // Sign-in form
  const emailRef  = useRef<HTMLInputElement>(null);
  const pwRef     = useRef<HTMLInputElement>(null);

  // Register form
  const regNameRef  = useRef<HTMLInputElement>(null);
  const regEmailRef = useRef<HTMLInputElement>(null);
  const regPwRef    = useRef<HTMLInputElement>(null);

  // Chart crosshair
  const [hoverX,    setHoverX]   = useState<number | null>(null);
  const [hoverY,    setHoverY]   = useState<number | null>(null);
  const [hoverIdx,  setHoverIdx] = useState<number | null>(null);

  const applyTheme = useCallback((t: string) => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const switchTab = (t: Tab) => { setTab(t); setError(''); };

  /* ── API calls ── */
  async function handleSignin() {
    const email = emailRef.current?.value.trim() ?? '';
    const password = pwRef.current?.value ?? '';
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '로그인에 실패했습니다.'); return; }
      router.push('/dashboard');
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const email    = regEmailRef.current?.value.trim() ?? '';
    const password = regPwRef.current?.value ?? '';
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '회원가입에 실패했습니다.'); return; }
      router.push('/dashboard');
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Password strength ── */
  function strength(v: string) {
    let score = 0;
    if (v.length >= 8)        score++;
    if (/[A-Z]/.test(v))      score++;
    if (/[0-9]/.test(v))      score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const colors = ['var(--down)', 'oklch(0.78 0.2 55)', 'var(--accent)', 'var(--up)'];
    const labels = ['취약', '보통', '강함', '매우 강함'];
    return { score, color: score > 0 ? colors[score - 1] : 'var(--line)', label: score > 0 ? labels[score - 1] : '' };
  }
  const str = strength(pw);

  /* ── Chart SVG data ── */
  const prices = CANDLES.flatMap(c => [c.h, c.l]);
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const cw = W / CANDLES.length;

  const linePts = CANDLES.map((c, i) => `${i * cw + cw / 2},${mapY((c.o + c.c) / 2, mn, mx)}`);
  const lineD   = 'M' + linePts.join('L');
  const areaD   = lineD + `L${W},${H} L0,${H} Z`;

  function onChartMove(e: React.MouseEvent<SVGRectElement>) {
    const svg  = e.currentTarget.closest('svg')!;
    const bb   = svg.getBoundingClientRect();
    const rx   = ((e.clientX - bb.left) / bb.width) * W;
    const ry   = ((e.clientY - bb.top)  / bb.height) * H;
    const idx  = Math.min(Math.floor(rx / cw), CANDLES.length - 1);
    setHoverX(rx); setHoverY(ry); setHoverIdx(idx);
  }

  return (
    <div className={s.page}>

      {/* ── Left panel ── */}
      <div className={s.left}>
        <div className={s.leftHeader}>
          <div className={s.logoMark}>
            <div className={s.logoIcon}/>
            <span className={s.logoText}>MOCKINVEST</span>
          </div>
          <span className={s.logoTag}>EXCHANGE</span>
          <div className={s.liveStatus}>
            <span>MARKET STATUS</span>
            <span style={{ color: 'var(--up)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className={s.liveDot}/> LIVE
            </span>
          </div>
        </div>

        {/* Mini tickers */}
        <div className={s.miniTickers}>
          {MINI_TICKERS.map(t => (
            <div key={t.pair} className={s.miniTicker}>
              <span className={s.mtPair}>{t.pair}</span>
              <span className={`${s.mtPrice} ${t.up ? s.mtPriceUp : s.mtPriceDn}`}>
                {t.price < 10
                  ? t.price.toFixed(4)
                  : t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`${s.mtChange} ${t.up ? s.mtChangeUp : s.mtChangeDn}`}>
                {t.up ? '+' : ''}{t.chg.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className={s.chartArea}>
          <div className={s.chartLabel}>
            <span className={s.chartPair}>BTC / USD</span>
            <span className={s.chartPriceBig}>
              ${hoverIdx !== null
                ? ((CANDLES[hoverIdx].o + CANDLES[hoverIdx].c) / 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '98,442.17'}
            </span>
            <span className={s.chartChangeBig}>+2.34%</span>
          </div>
          <svg className={s.svgChart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="oklch(0.78 0.17 155)" stopOpacity="0.18"/>
                <stop offset="100%" stopColor="oklch(0.78 0.17 155)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#areaGrad)"/>
            <path d={lineD} fill="none" stroke="var(--up)" strokeWidth="1.5" className={s.chartLineAnimate}/>
            {CANDLES.map((c, i) => {
              const x   = i * cw + cw * 0.2;
              const bw  = cw * 0.6;
              const yO  = mapY(c.o, mn, mx), yC = mapY(c.c, mn, mx);
              const yH  = mapY(c.h, mn, mx), yL = mapY(c.l, mn, mx);
              const col = c.c >= c.o ? 'var(--up)' : 'var(--down)';
              const top = Math.min(yO, yC), bh = Math.max(1, Math.abs(yO - yC));
              return (
                <g key={i}>
                  <line x1={x + bw / 2} y1={yH} x2={x + bw / 2} y2={yL} stroke={col} strokeWidth="1" opacity="0.7"/>
                  <rect x={x} y={top} width={bw} height={bh} fill={col} opacity="0.85" rx="0.5"/>
                </g>
              );
            })}
            {hoverX !== null && (
              <g pointerEvents="none">
                <line x1={hoverX} y1={0} x2={hoverX} y2={H} stroke="var(--fg-3)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
                <line x1={0} y1={hoverY!} x2={W} y2={hoverY!} stroke="var(--fg-3)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5"/>
              </g>
            )}
            <rect
              x={0} y={0} width={W} height={H} fill="transparent"
              onMouseMove={onChartMove}
              onMouseLeave={() => { setHoverX(null); setHoverY(null); setHoverIdx(null); }}
            />
          </svg>
        </div>

        {/* Market rows */}
        <div className={s.marketRows}>
          {MARKET_ROWS.map(m => (
            <div key={m.pair} className={s.mrow}>
              <span className={s.mrowPair}>{m.pair}</span>
              <span className={`${s.mrowPrice} ${m.up ? s.mrowPriceUp : s.mrowPriceDn}`}>{m.price}</span>
              <span className={s.mrowVol}>Vol {m.vol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={s.right}>
        <div className={s.eyebrow}>Secure Access</div>
        <div className={s.title}>계정에 로그인</div>
        <div className={s.sub}>Sign in to your MockInvest account</div>

        <div className={s.authTabs}>
          <button className={`${s.authTab} ${tab === 'signin'   ? s.authTabActive : ''}`} onClick={() => switchTab('signin')}>로그인</button>
          <button className={`${s.authTab} ${tab === 'register' ? s.authTabActive : ''}`} onClick={() => switchTab('register')}>회원가입</button>
        </div>

        {error && <div className={s.errorMsg}>{error}</div>}

        {/* ── Sign In ── */}
        {tab === 'signin' && (
          <div className={s.animated}>
            <div className={s.fieldGroup}>
              <div className={s.field}>
                <label className={s.fieldLabel}>이메일 / Email</label>
                <div className={s.fieldWrap}>
                  <IconEmail className={s.fieldIcon}/>
                  <input ref={emailRef} type="email" className={s.fieldInput}
                    placeholder="trader@mockinvest.io" autoComplete="email"
                    onKeyDown={e => e.key === 'Enter' && pwRef.current?.focus()}/>
                </div>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>비밀번호 / Password</label>
                <div className={s.fieldWrap}>
                  <IconLock className={s.fieldIcon}/>
                  <input ref={pwRef} type={showPw ? 'text' : 'password'} className={s.fieldInput}
                    placeholder="••••••••••••" autoComplete="current-password"
                    onKeyDown={e => e.key === 'Enter' && handleSignin()}/>
                  <button className={s.fieldAction} type="button" onClick={() => setShowPw(v => !v)}>
                    {showPw ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            </div>

            <div className={s.formRow}>
              <label className={s.checkboxWrap}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}/>
                <span className={s.checkboxLabel}>로그인 상태 유지</span>
              </label>
              <button className={s.forgotLink} type="button">비밀번호 찾기</button>
            </div>

            <button className={s.btnPrimary} onClick={handleSignin} disabled={loading}>
              {loading ? <span className={s.spinner}/> : null}
              <span>로그인</span>
              <ArrowIcon/>
            </button>

          </div>
        )}

        {/* ── Register ── */}
        {tab === 'register' && (
          <div className={s.animated}>
            <div className={s.fieldGroup}>
              <div className={s.field}>
                <label className={s.fieldLabel}>이메일 / Email</label>
                <div className={s.fieldWrap}>
                  <IconEmail className={s.fieldIcon}/>
                  <input ref={regEmailRef} type="email" className={s.fieldInput}
                    placeholder="trader@mockinvest.io" autoComplete="email"/>
                </div>
              </div>
              <div className={s.field}>
                <label className={s.fieldLabel}>비밀번호 / Password</label>
                <div className={s.fieldWrap}>
                  <IconLock className={s.fieldIcon}/>
                  <input ref={regPwRef} type="password" className={s.fieldInput}
                    placeholder="6자 이상" autoComplete="new-password"
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRegister()}/>
                </div>
                <div className={s.strengthBars}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={s.strengthBar}
                      style={{ background: i <= str.score ? str.color : 'var(--line)' }}/>
                  ))}
                </div>
                {str.label && <div className={s.strengthLabel}>{str.label}</div>}
              </div>
            </div>

            <button className={s.btnPrimary} onClick={handleRegister} disabled={loading}>
              {loading ? <span className={s.spinner}/> : null}
              <span>계정 만들기</span>
              <ArrowIcon/>
            </button>

            <div className={s.securityRow} style={{ marginTop: 10 }}>
              <div className={s.securityDot}/>
              <span className={s.securityText}>즉시 거래 가능 · 초기 자본 $100,000 지급</span>
            </div>
          </div>
        )}

        <div className={s.formFooter}>
          <div className={s.footerLinks}>
            <button className={s.footerLink}>이용약관</button>
            <button className={s.footerLink}>개인정보처리방침</button>
            <button className={s.footerLink}>고객센터</button>
          </div>
          <span className={s.footerVersion}>v1.0.0</span>
        </div>
      </div>

      {/* ── Tweaks ── */}
      <button className={s.tweaksToggle} onClick={() => setShowTweaks(v => !v)} title="Display settings">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41"/>
        </svg>
      </button>
      {showTweaks && (
        <div className={s.tweaksPanel}>
          <div>
            <div className={s.tweaksSectionTitle}>Theme</div>
            <div className={s.tweaksOptions}>
              {[['', 'Midnight'], ['carbon', 'Carbon'], ['ivory', 'Ivory']].map(([val, label]) => (
                <button key={val} className={`${s.tweakChip} ${theme === val ? s.tweakChipActive : ''}`}
                  onClick={() => applyTheme(val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className={s.tweaksSectionTitle}>Form</div>
            <div className={s.tweaksOptions}>
              <button className={`${s.tweakChip} ${tab === 'signin'   ? s.tweakChipActive : ''}`} onClick={() => { switchTab('signin');   setShowTweaks(false); }}>로그인</button>
              <button className={`${s.tweakChip} ${tab === 'register' ? s.tweakChipActive : ''}`} onClick={() => { switchTab('register'); setShowTweaks(false); }}>회원가입</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline SVG icons ── */
function IconEmail({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,12 2,6"/>
    </svg>
  );
}
function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="var(--fg-2)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="var(--fg-2)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="var(--fg-2)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="var(--fg-2)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/* ── Page export with Suspense ── */
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg-0)', height: '100vh' }}/>}>
      <LoginInner/>
    </Suspense>
  );
}
