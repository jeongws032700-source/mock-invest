'use client';
import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fmtUSD, fmtPct, fmtSize, I, Sparkline } from './common';
import { WATCHLIST, RECENT_TRADES, genOrderbook } from '@/lib/market-data';
import type { Coin } from '@/lib/market-data';

interface DbPosition { coin: string; quantity: number; avg_price: number; }

export function Watchlist({ coins, selectedSym, onSelect }: {
  coins: Coin[]; selectedSym: string; onSelect: (sym: string) => void;
}) {
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', '★', 'USDT', 'Gainers', 'Losers'];

  const filtered = useMemo(() => {
    let list = coins;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(c => c.sym.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (filter === 'Gainers') list = [...list].sort((a, b) => b.chgPct - a.chgPct);
    if (filter === 'Losers')  list = [...list].sort((a, b) => a.chgPct - b.chgPct);
    if (filter === '★')       list = list.slice(0, 6);
    return list;
  }, [coins, query, filter]);

  return (
    <div className="panel watchlist-panel">
      <div className="panel-head">
        <span className="title">Watchlist</span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>관심종목</span>
        <span className="count" style={{ marginLeft: 'auto' }}>{filtered.length}</span>
      </div>
      <div className="wl-search">
        {I.search}
        <input placeholder="Search symbol…" value={query} onChange={e => setQuery(e.target.value)}/>
      </div>
      <div className="wl-filters">
        {filters.map(f => (
          <button key={f} className={'wl-filter' + (f === filter ? ' active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="wl-list">
        {filtered.map(c => (
          <div key={c.sym}
               className={'wl-row' + (c.sym === selectedSym ? ' selected' : '')}
               onClick={() => onSelect(c.sym)}>
            <div className="wl-sym">
              <div className={'wl-icon ' + c.icon}>{c.mark}</div>
              <div className="wl-name">
                <div className="s">{c.sym}<span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 10, marginLeft: 4 }}>/USDT</span></div>
                <div className="n">{c.name}</div>
              </div>
            </div>
            <div className="wl-prices">
              <div className="p mono">{fmtUSD(c.price)}</div>
              <div className={'c ' + (c.chgPct >= 0 ? 'up' : 'down')}>{fmtPct(c.chgPct)}</div>
            </div>
            <Sparkline data={c.spark} color={c.chgPct >= 0 ? 'var(--up)' : 'var(--down)'} width={220} height={16}/>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Orderbook({ coin, balance = 0, positions = [] }: {
  coin: Coin; balance?: number; positions?: DbPosition[];
}) {
  const { asks, bids } = useMemo(() => genOrderbook(coin.seed + 7, coin.price), [coin]);
  const maxTotal  = Math.max(asks[asks.length - 1].total, bids[bids.length - 1].total);
  const spread    = asks[0].price - bids[0].price;
  const spreadPct = (spread / coin.price) * 100;
  const dec       = coin.price > 100 ? 2 : 4;

  /* ── Trade form state ── */
  const qc = useQueryClient();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty,  setQty]  = useState('');
  const [err,  setErr]  = useState('');
  const holding = positions.find(p => p.coin === coin.sym);

  const trade = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin: coin.sym, type: side, quantity: Number(qty), price: coin.price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '거래 실패');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); setQty(''); setErr(''); },
    onError: (e: Error) => setErr(e.message),
  });

  const total = Number(qty) * coin.price;
  const pct25 = side === 'buy'
    ? (balance * 0.25 / coin.price).toFixed(6)
    : ((holding?.quantity ?? 0) * 0.25).toFixed(6);
  const pct50 = side === 'buy'
    ? (balance * 0.5  / coin.price).toFixed(6)
    : ((holding?.quantity ?? 0) * 0.5).toFixed(6);
  const pctMax = side === 'buy'
    ? (balance / coin.price).toFixed(6)
    : String(holding?.quantity ?? 0);

  return (
    <div className="panel orderbook-panel" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── 상단: 호가창 (50%) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-head">
          <span className="title">Order Book</span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>호가</span>
        </div>
        <div className="ob-head">
          <div className="c1">Price (USDT)</div>
          <div className="c2">Size ({coin.sym})</div>
          <div className="c3">Total</div>
        </div>
        <div className="ob-rows">
          <div className="ob-asks">
            {asks.map((r, i) => (
              <div key={'a' + i} className="ob-row ask" onClick={() => setQty((r.size).toFixed(6))}>
                <div className="depth" style={{ width: `${(r.total / maxTotal) * 100}%` }}/>
                <span className="price mono">{fmtUSD(r.price, dec)}</span>
                <span className="size mono">{fmtSize(r.size)}</span>
                <span className="total mono">{fmtSize(r.total)}</span>
              </div>
            ))}
          </div>
          <div className="ob-spread">
            <span className={'big mono ' + (coin.chgPct >= 0 ? 'up' : 'down')}>{fmtUSD(coin.price, dec)}</span>
            <div style={{ textAlign: 'right' }}>
              <div className="lbl">Spread</div>
              <div className="spr">{fmtUSD(spread, dec)} · {spreadPct.toFixed(3)}%</div>
            </div>
          </div>
          <div className="ob-bids">
            {bids.map((r, i) => (
              <div key={'b' + i} className="ob-row bid" onClick={() => setQty((r.size).toFixed(6))}>
                <div className="depth" style={{ width: `${(r.total / maxTotal) * 100}%` }}/>
                <span className="price mono">{fmtUSD(r.price, dec)}</span>
                <span className="size mono">{fmtSize(r.size)}</span>
                <span className="total mono">{fmtSize(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div style={{ height: 1, background: 'var(--line)' }}/>

      {/* ── 하단: 매수/매도 폼 (50%) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: 10, overflow: 'hidden' }}>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['buy', 'sell'] as const).map(s => (
            <button key={s} onClick={() => { setSide(s); setErr(''); setQty(''); }} style={{
              flex: 1, padding: '7px 0', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: side === s ? (s === 'buy' ? 'var(--up)' : 'var(--down)') : 'var(--bg-2)',
              color: side === s ? '#fff' : 'var(--fg-2)',
              transition: 'background 0.15s',
            }}>{s === 'buy' ? '매수 Buy' : '매도 Sell'}</button>
          ))}
        </div>

        {/* 잔고/보유 정보 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)' }}>
          <span>{side === 'buy' ? '가용 잔고' : '보유 수량'}</span>
          <span style={{ color: 'var(--fg-1)', fontFamily: 'var(--mono)' }}>
            {side === 'buy' ? `$${fmtUSD(balance)}` : `${holding?.quantity ?? 0} ${coin.sym}`}
          </span>
        </div>

        {/* 수량 입력 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden' }}>
            <input
              type="number" min="0" step="any" value={qty}
              onChange={e => { setQty(e.target.value); setErr(''); }}
              placeholder="수량"
              style={{ flex: 1, padding: '8px 10px', fontSize: 13, background: 'none', border: 'none', color: 'var(--fg-0)' }}
            />
            <span style={{ padding: '0 10px', fontSize: 11, color: 'var(--fg-3)', borderLeft: '1px solid var(--line)' }}>{coin.sym}</span>
          </div>
          {/* % 버튼 */}
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[['25%', pct25], ['50%', pct50], ['MAX', pctMax]].map(([label, val]) => (
              <button key={label} onClick={() => setQty(val)} style={{
                flex: 1, padding: '4px 0', fontSize: 10, borderRadius: 4,
                background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--fg-2)',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* 예상 금액 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-3)' }}>
          <span>예상 {side === 'buy' ? '결제' : '수령'}</span>
          <span style={{ color: qty && Number(qty) > 0 ? 'var(--fg-0)' : 'var(--fg-3)', fontFamily: 'var(--mono)' }}>
            {qty && Number(qty) > 0 ? `$${fmtUSD(total)}` : '—'}
          </span>
        </div>

        {err && <div style={{ fontSize: 11, color: 'var(--down)' }}>{err}</div>}

        {/* 주문 버튼 */}
        <button
          onClick={() => trade.mutate()}
          disabled={trade.isPending || !qty || Number(qty) <= 0}
          style={{
            marginTop: 'auto', padding: '10px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            background: side === 'buy' ? 'var(--up)' : 'var(--down)', color: '#fff',
            opacity: (trade.isPending || !qty || Number(qty) <= 0) ? 0.45 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {trade.isPending ? '처리 중...' : side === 'buy' ? `${coin.sym} 매수` : `${coin.sym} 매도`}
        </button>
      </div>
    </div>
  );
}

interface DbPosition { coin: string; quantity: number; avg_price: number; }

export function PositionsTable({ positions = [], coins = [] }: { positions?: DbPosition[]; coins?: Coin[] }) {
  const [tab, setTab] = useState<'positions' | 'history'>('positions');

  const rows = positions.map(p => {
    const c      = coins.find(c => c.sym === p.coin);
    const mark   = c?.price ?? p.avg_price;
    const pnl    = (mark - p.avg_price) * p.quantity;
    const pnlPct = ((mark - p.avg_price) / p.avg_price) * 100;
    return { ...p, mark, pnl, pnlPct, coin: c };
  });

  const totalPnL = rows.reduce((s, r) => s + r.pnl, 0);

  return (
    <div className="panel positions-panel">
      <div className="tbl-tabs">
        <button className={'tbl-tab' + (tab === 'positions' ? ' active' : '')} onClick={() => setTab('positions')}>
          Positions / 포지션 <span className="badge">{rows.length}</span>
        </button>
        <button className={'tbl-tab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>
          History / 내역
        </button>
        <div style={{ marginLeft: 'auto', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11 }}>
          <span style={{ color: 'var(--fg-3)' }}>Total uPnL</span>
          <span className={'mono ' + (totalPnL >= 0 ? 'up' : 'down')} style={{ fontWeight: 600 }}>
            {totalPnL >= 0 ? '+' : ''}${fmtUSD(Math.abs(totalPnL))}
          </span>
        </div>
      </div>
      <div className="tbl-wrap">
        {tab === 'positions' && (
          rows.length === 0 ? (
            <div className="empty">
              <div className="mono-k">No open positions</div>
              <div style={{ fontSize: 11 }}>보유 포지션이 없습니다</div>
            </div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>Symbol</th>
                <th className="num">수량</th>
                <th className="num">평균단가</th>
                <th className="num">현재가</th>
                <th className="num">평가금액</th>
                <th className="num">uPnL (USD)</th>
                <th className="num">ROI %</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div className="sym-cell">
                        {r.coin && <div className={'icon ' + r.coin.icon}>{r.coin.mark}</div>}
                        {r.coin?.sym ?? r.coin}{'/USDT'}
                      </div>
                    </td>
                    <td className="num mono">{r.quantity}</td>
                    <td className="num">{fmtUSD(r.avg_price)}</td>
                    <td className="num">{fmtUSD(r.mark)}</td>
                    <td className="num">{fmtUSD(r.mark * r.quantity)}</td>
                    <td className={'num ' + (r.pnl >= 0 ? 'up' : 'down')}>
                      {r.pnl >= 0 ? '+' : ''}{fmtUSD(r.pnl)}
                    </td>
                    <td className={'num ' + (r.pnlPct >= 0 ? 'up' : 'down')}>{fmtPct(r.pnlPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === 'history' && (
          <div className="empty">
            <div className="mono-k">거래 내역은 포트폴리오 탭에서 확인하세요</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewsPanel() {
  const NEWS_DATA = [
    { time: '14:28', src: 'Bloomberg',     ttl: 'BlackRock Bitcoin ETF 순유입 8일 연속, 총 $4.2B 유입',           tags: ['BTC', 'ETF']        },
    { time: '14:16', src: 'CoinDesk',      ttl: 'Solana 활성 주소수 월간 최고치 경신 — 2.14M addresses',         tags: ['SOL', 'ON-CHAIN']   },
    { time: '13:54', src: 'Reuters',       ttl: 'Fed 의장 발언: 금리 인하 시점 재조정 가능성 시사',               tags: ['MACRO', 'RATES']    },
    { time: '13:32', src: 'The Block',     ttl: 'Chainlink CCIP, 주요 은행 4곳과 토큰화 파일럿 개시',            tags: ['LINK']              },
    { time: '13:08', src: 'Coinbase',      ttl: 'Ethereum L2 TVL 처음으로 $85B 돌파',                            tags: ['ETH', 'L2']         },
    { time: '12:44', src: 'Binance',       ttl: 'Avalanche 네트워크 업그레이드, 수수료 40% 감소',                 tags: ['AVAX']              },
    { time: '12:20', src: 'Decrypt',       ttl: 'SEC, 알트코인 ETF 신청 3건 추가 검토 단계 진입',                 tags: ['REGULATION']        },
    { time: '11:58', src: 'Cointelegraph', ttl: 'MicroStrategy, BTC 3,140개 추가 매입 공시',                     tags: ['BTC', 'TREASURY']   },
  ];
  return (
    <div className="panel news-panel">
      <div className="panel-head">
        <span className="title">News Feed</span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>실시간 뉴스</span>
        <div className="tabs">
          <button className="tab active">All</button>
          <button className="tab">BTC</button>
        </div>
      </div>
      <div className="news-list">
        {NEWS_DATA.map((n, i) => (
          <div key={i} className="news-item">
            <div className="news-meta">
              <span className="news-source">{n.src}</span>
              <span>{n.time}</span>
            </div>
            <div className="news-ttl">{n.ttl}</div>
            <div className="news-tags">
              {n.tags.map(t => <span key={t} className="news-tag">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
