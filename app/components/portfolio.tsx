'use client';
import { fmtUSD, fmtPct } from './common';
import { WATCHLIST, genSpark } from '@/lib/market-data';

interface DbPosition { coin: string; quantity: number; avg_price: number; }
interface Coin { sym: string; price: number; icon: string; mark: string; [key: string]: any; }
interface DbTransaction { coin: string; type: string; quantity: number; price: number; total: number; created_at: string; }

export function PortfolioView({ positions = [], balance = 0, coins = WATCHLIST, transactions = [] }: { positions?: DbPosition[]; balance?: number; coins?: Coin[]; transactions?: DbTransaction[] }) {

  const rows = positions.map(p => {
    const c      = coins.find(c => c.sym === p.coin);
    const price  = c?.price ?? p.avg_price;
    const value  = price * p.quantity;
    const pnl    = (price - p.avg_price) * p.quantity;
    const pnlPct = ((price - p.avg_price) / p.avg_price) * 100;
    return { sym: p.coin, quantity: p.quantity, avg_price: p.avg_price, price, value, pnl, pnlPct, icon: c?.icon ?? 'icon-default', mark: c?.mark ?? p.coin[0] };
  });

  const holdingsValue = rows.reduce((s, r) => s + r.value, 0);
  const totalUSD      = balance + holdingsValue;
  const totalPnL      = rows.reduce((s, r) => s + r.pnl, 0);

  const alloc = [
    { sym: 'USDT', usd: balance, pct: totalUSD > 0 ? (balance / totalUSD) * 100 : 0, icon: 'icon-usdt' },
    ...rows.map(r => ({ sym: r.sym, usd: r.value, pct: totalUSD > 0 ? (r.value / totalUSD) * 100 : 0, icon: r.icon })),
  ].filter(a => a.usd > 0);

  return (
    <div className="overview">
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 6 }}>
          Portfolio Overview · 자산 현황
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div className="mono" style={{ fontSize: 40, fontWeight: 600, color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>
            ${fmtUSD(totalUSD, 2)}
          </div>
          {totalPnL !== 0 && (
            <div className={'mono ' + (totalPnL >= 0 ? 'up' : 'down')} style={{ fontSize: 14 }}>
              {totalPnL >= 0 ? '▲' : '▼'} {totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL)} (미실현 손익)
            </div>
          )}
        </div>
      </div>

      <div className="ov-hero">
        <div className="ov-cell">
          <span className="k">Available Balance</span>
          <span className="v mono">${fmtUSD(balance, 2)}</span>
          <span className="sub" style={{ color: 'var(--fg-3)' }}>가용 잔액 · USDT</span>
        </div>
        <div className="ov-cell">
          <span className="k">Holdings Value</span>
          <span className="v mono">${fmtUSD(holdingsValue, 2)}</span>
          <span className="sub" style={{ color: 'var(--fg-3)' }}>보유 코인 평가액</span>
        </div>
        <div className="ov-cell">
          <span className="k">Unrealized PnL</span>
          <span className={'v mono ' + (totalPnL >= 0 ? 'up' : 'down')}>
            {totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL, 2)}
          </span>
          <span className={'sub ' + (totalPnL >= 0 ? 'up' : 'down')}>미실현 손익</span>
        </div>
        <div className="ov-cell">
          <span className="k">Positions</span>
          <span className="v mono">{rows.length}</span>
          <span className="sub" style={{ color: 'var(--fg-3)' }}>보유 코인 종류</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', overflow: 'hidden' }}>
        {/* 왼쪽: 보유 자산 */}
        <div style={{ background: 'var(--bg-1)', padding: 20, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 12 }}>
            Holdings · 보유 자산
          </div>
          {rows.length === 0 ? (
            <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>보유 코인이 없습니다. 트레이딩 탭에서 매수해보세요.</div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>코인</th>
                <th className="num">수량</th>
                <th className="num">평균단가</th>
                <th className="num">현재가</th>
                <th className="num">평가금액</th>
                <th className="num">손익</th>
                <th className="num">수익률</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div className="sym-cell">
                        <div className={'wl-icon ' + r.icon} style={{ width: 20, height: 20, fontSize: 10 }}>{r.mark}</div>
                        {r.sym}
                      </div>
                    </td>
                    <td className="num mono">{r.quantity}</td>
                    <td className="num">{fmtUSD(r.avg_price)}</td>
                    <td className="num">{fmtUSD(r.price)}</td>
                    <td className="num">{fmtUSD(r.value)}</td>
                    <td className={'num ' + (r.pnl >= 0 ? 'up' : 'down')}>
                      {r.pnl >= 0 ? '+' : ''}{fmtUSD(r.pnl)}
                    </td>
                    <td className={'num ' + (r.pnlPct >= 0 ? 'up' : 'down')}>{fmtPct(r.pnlPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* 오른쪽: 거래 내역 */}
        <div style={{ background: 'var(--bg-1)', padding: 20, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 12 }}>
            Trade History · 거래 내역
          </div>
          {transactions.length === 0 ? (
            <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>거래 내역이 없습니다.</div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>코인</th>
                <th>유형</th>
                <th className="num">수량</th>
                <th className="num">체결가</th>
                <th className="num">거래금액</th>
                <th className="num">일시</th>
              </tr></thead>
              <tbody>
                {transactions.map((t, i) => {
                  const c = coins.find(c => c.sym === t.coin);
                  const isBuy = t.type === 'buy';
                  const dt = new Date(t.created_at);
                  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
                  return (
                    <tr key={i}>
                      <td>
                        <div className="sym-cell">
                          <div className={'wl-icon ' + (c?.icon ?? '')} style={{ width: 20, height: 20, fontSize: 10 }}>{c?.mark ?? t.coin[0]}</div>
                          {t.coin}/USDT
                        </div>
                      </td>
                      <td><span className={'mono ' + (isBuy ? 'up' : 'down')} style={{ fontWeight: 600 }}>{isBuy ? '매수' : '매도'}</span></td>
                      <td className="num mono">{Number(t.quantity)}</td>
                    <td className="num mono">${fmtUSD(Number(t.price))}</td>
                    <td className="num mono">${fmtUSD(Number(t.total))}</td>
                    <td className="num" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{dateStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      </div>
    </div>
  );
}

function EquityCurve() {
  const data = genSpark(42, 90);
  const w = 600, h = 160;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h * 0.9 - 8}`).join(' ');
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--up)" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="var(--up)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill="url(#eq)"/>
      <polyline points={pts} fill="none" stroke="var(--up)" strokeWidth="1.5"/>
    </svg>
  );
}

function Allocation({ alloc }: { alloc: { sym: string; usd: number; pct: number; icon: string }[] }) {
  return (
    <div>
      {alloc.map(a => (
        <div key={a.sym} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className={'wl-icon ' + a.icon} style={{ width: 20, height: 20, fontSize: 10 }}>{a.sym[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{a.sym}</span>
              <span className="mono" style={{ color: 'var(--fg-2)' }}>{a.pct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${a.pct}%`, height: '100%', background: 'var(--fg-1)' }}/>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>${fmtUSD(a.usd, 0)}</div>
          </div>
        </div>
      ))}
      {alloc.length === 0 && (
        <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>자산 없음</div>
      )}
    </div>
  );
}
