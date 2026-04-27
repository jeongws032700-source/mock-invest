'use client';
import { useState } from 'react';
import { fmtUSD, fmtPct } from './common';
import { WATCHLIST } from '@/lib/market-data';
import type { Coin } from '@/lib/market-data';

interface DbPosition { coin: string; quantity: number; avg_price: number; }
interface DbTransaction { coin: string; type: string; quantity: number; price: number; total: number; created_at: string; }
type CalendarCell =
  | { kind: 'blank'; key: string }
  | { kind: 'day'; key: string; day: number; pnl: number; trades: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FALLBACK_MONTH = new Date('2026-04-27T00:00:00');
const MONTH_LABEL = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function PortfolioView({ positions = [], balance = 0, coins = WATCHLIST, transactions = [] }: { positions?: DbPosition[]; balance?: number; coins?: Coin[]; transactions?: DbTransaction[] }) {
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

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
  const latestTradeDate = transactions[0] ? new Date(transactions[0].created_at) : FALLBACK_MONTH;
  const visibleMonth = addMonths(latestTradeDate, monthOffset);
  const visibleMonthKey = monthKey(visibleMonth);
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const dailyPnL = new Map<string, { pnl: number; trades: number }>();
  const ledger = new Map<string, { amount: number; avgPrice: number }>();

  [...transactions]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(t => {
    const tradeDate = new Date(t.created_at);
    const quantity = Number(t.quantity);
    const price = Number(t.price);
    const currentPosition = ledger.get(t.coin) ?? { amount: 0, avgPrice: 0 };
    let realizedPnL = 0;

    if (t.type === 'buy') {
      const nextAmount = currentPosition.amount + quantity;
      const nextAvgPrice = nextAmount > 0
        ? ((currentPosition.avgPrice * currentPosition.amount) + (price * quantity)) / nextAmount
        : price;
      ledger.set(t.coin, { amount: nextAmount, avgPrice: nextAvgPrice });
    } else {
      realizedPnL = currentPosition.amount > 0
        ? (price - currentPosition.avgPrice) * quantity
        : 0;
      ledger.set(t.coin, {
        amount: Math.max(0, currentPosition.amount - quantity),
        avgPrice: currentPosition.avgPrice,
      });
    }

    if (monthKey(tradeDate) !== visibleMonthKey) return;

    const key = dateKey(tradeDate);
    const current = dailyPnL.get(key) ?? { pnl: 0, trades: 0 };
    dailyPnL.set(key, { pnl: current.pnl + realizedPnL, trades: current.trades + 1 });
  });

  const monthlyPnL = Array.from(dailyPnL.values()).reduce((sum, day) => sum + day.pnl, 0);
  const monthTradeCount = Array.from(dailyPnL.values()).reduce((sum, day) => sum + day.trades, 0);
  const calendarCells: CalendarCell[] = [
    ...Array.from({ length: monthStart.getDay() }, (_, i) => ({ kind: 'blank' as const, key: `blank-${i}` })),
    ...Array.from({ length: monthEnd.getDate() }, (_, i) => {
      const day = i + 1;
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      const stats = dailyPnL.get(dateKey(date));
      return { kind: 'day' as const, key: String(day), day, pnl: stats?.pnl ?? 0, trades: stats?.trades ?? 0 };
    }),
  ];

  return (
    <div className="overview">
      <div className="portfolio-title-row">
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 6 }}>
          Portfolio Overview · 자산 현황
        </div>
        <div className="portfolio-title-main">
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
          <button className="monthly-pnl-button" onClick={() => setShowMonthly(true)}>
            월별 수익
          </button>
        </div>
      </div>

      {showMonthly && (
        <div className="monthly-overlay" onClick={() => setShowMonthly(false)}>
          <div className="monthly-modal" onClick={e => e.stopPropagation()}>
            <div className="monthly-head">
              <div>
                <div className="monthly-eyebrow">Monthly PnL · 월별 수익</div>
                <div className="monthly-title">{MONTH_LABEL.format(visibleMonth)}</div>
              </div>
              <div className="monthly-actions">
                <button onClick={() => setMonthOffset(v => v - 1)}>이전달</button>
                <button onClick={() => setMonthOffset(0)}>최근</button>
                <button onClick={() => setMonthOffset(v => v + 1)}>다음달</button>
                <button className="monthly-close" onClick={() => setShowMonthly(false)}>×</button>
              </div>
            </div>

            <div className="monthly-summary">
              <div className={'monthly-pnl-card ' + (monthlyPnL >= 0 ? 'profit' : 'loss')}>
                <span>월 실현 손익</span>
                <strong className={'mono ' + (monthlyPnL >= 0 ? 'up' : 'down')}>
                  {monthlyPnL >= 0 ? '+' : '-'}${fmtUSD(Math.abs(monthlyPnL), 2)}
                </strong>
              </div>
              <div>
                <span>거래 수</span>
                <strong className="mono">{monthTradeCount}</strong>
              </div>
              <div>
                <span>표시 기준</span>
                <strong>매도 체결 기준</strong>
              </div>
            </div>

            <div className="monthly-calendar">
              {WEEKDAYS.map(day => (
                <div key={day} className="monthly-weekday">{day}</div>
              ))}
              {calendarCells.map(cell => (
                cell.kind === 'blank' ? (
                  <div key={cell.key} className="monthly-day blank" />
                ) : (
                  <div key={cell.key} className={'monthly-day' + (cell.trades > 0 ? ' active' : '')}>
                    <span className="monthly-day-num">{cell.day}</span>
                    {cell.trades > 0 && (
                      <>
                        <strong className={'mono ' + (cell.pnl >= 0 ? 'up' : 'down')}>
                          {cell.pnl >= 0 ? '+' : '-'}${fmtUSD(Math.abs(cell.pnl), 2)}
                        </strong>
                        <small>{cell.trades}건</small>
                      </>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

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
