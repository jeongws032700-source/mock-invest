'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useMutation used for logout
import { Chart }           from '@/app/components/chart';
import { Watchlist, Orderbook, PositionsTable } from '@/app/components/panels';
import { PortfolioView }   from '@/app/components/portfolio';
import { MarketStream }    from '@/app/components/MarketStream';
import { fmtUSD, fmtBig, fmtPct, I } from '@/app/components/common';
import { WATCHLIST } from '@/lib/market-data';
import type { Candle } from '@/lib/market-data';
import { usePriceStore } from '@/lib/priceStore';

const TIMEFRAMES  = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
const TF_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m',
  '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
};
const CHART_TYPES = [
  { id: 'candle', label: 'C' },
  { id: 'area',   label: 'A' },
  { id: 'bars',   label: 'B' },
];
type Layout = 'classic' | 'focus' | 'dense';

interface Position { coin: string; quantity: number; avg_price: number; }
interface Transaction { coin: string; type: string; quantity: number; price: number; total: number; created_at: string; }
interface MeData { email: string; balance: number; positions: Position[]; transactions: Transaction[]; }


export default function Dashboard() {
  const router = useRouter();
  const qc     = useQueryClient();

  const [selectedSym, setSelectedSym] = useState('BTC');
  const [tf,          setTf]          = useState('1H');
  const [chartType,   setChartType]   = useState('candle');
  const [view,        setView]        = useState<'trading' | 'portfolio'>('trading');
  const [layout,      setLayout]      = useState<Layout>('classic');
  const [showTweaks,  setShowTweaks]  = useState(false);
  const [numStyle,    setNumStyle]    = useState('default');

  const { data: me } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then(r => r.json()),
    refetchInterval: 30_000,
  });

  const logout = useMutation({
    mutationFn: () => fetch('/api/auth/logout', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { qc.clear(); router.push('/login'); },
  });

  const livePrices  = usePriceStore(s => s.prices);
  const wsConnected = usePriceStore(s => s.wsConnected);

  const liveCoins = WATCHLIST.map(c => {
    const live = livePrices[c.sym];
    if (!live) return c;
    return { ...c, price: live.price, chgPct: live.chgPct, vol24: live.vol24 };
  });

  const coin   = liveCoins.find(c => c.sym === selectedSym) ?? liveCoins[0];
  const lastUp = coin.chgPct >= 0;

  const { data: klines } = useQuery({
    queryKey: ['klines', selectedSym, tf],
    queryFn: async () => {
      const interval = TF_MAP[tf] ?? '1h';
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${selectedSym}USDT&interval=${interval}&limit=1000`
      );
      const raw = await res.json() as [number, string, string, string, string, string][];
      return raw.map(k => ({
        t: k[0], o: parseFloat(k[1]), h: parseFloat(k[2]),
        l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]),
      } satisfies Candle));
    },
    staleTime: 30_000,
  });

  const candles = klines ?? coin.candles;
  const scaledCoin = (() => {
    if (!candles.length) return { ...coin, candles };
    const last = candles[candles.length - 1];
    const livePrice = coin.price;
    const updatedLast = {
      ...last,
      c: livePrice,
      h: Math.max(last.h, livePrice),
      l: Math.min(last.l, livePrice),
    };
    return { ...coin, candles: [...candles.slice(0, -1), updatedLast] };
  })();

  const balance      = me?.balance ?? 0;
  const positions    = me?.positions ?? [];
  const transactions = me?.transactions ?? [];

  const setTheme = (t: string) =>
    document.documentElement.setAttribute('data-theme', t === 'midnight' ? '' : t);

  const setNums = (s: string) => {
    setNumStyle(s);
    document.documentElement.setAttribute('data-numstyle', s);
  };

  return (
    <div className="app">

      <MarketStream />

      {/* ── Top Nav ── */}
      <nav className="topnav">
        <div className="logo">
          <div className="logo-mark">M</div>
          <div className="logo-text">MOCK<span style={{ color: 'var(--fg-3)' }}>INVEST</span></div>
        </div>
        <div className="nav-tabs">
          <button className={'nav-tab' + (view === 'trading'   ? ' active' : '')} onClick={() => setView('trading')}>
            Trading <span className="ko">트레이딩</span>
          </button>
          <button className={'nav-tab' + (view === 'portfolio' ? ' active' : '')} onClick={() => setView('portfolio')}>
            Portfolio <span className="ko">포트폴리오</span>
          </button>
        </div>
        <div className="top-right">
          <div className="balance-pill">
            <span className="label">Balance</span>
            <span style={{ color: 'var(--fg-0)', fontWeight: 600 }}>
              {me ? `$${fmtUSD(balance, 2)}` : '—'}
            </span>
          </div>
          <button className="iconbtn" style={{ position: 'relative' }} title="Alerts">
            {I.bell}
            <span className="dot"/>
          </button>
          <button className="iconbtn" onClick={() => setShowTweaks(v => !v)} title="Display settings">
            {I.tweak}
          </button>
          <button className="topbtn primary" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {I.logout}&nbsp;로그아웃
          </button>
        </div>
      </nav>

      {/* ── Ticker Bar ── */}
      <div className="ticker-bar">
        <div className="ticker-label">
          <span className="dot" style={{
            background: 'var(--up)', width: 6, height: 6, borderRadius: '50%',
            boxShadow: '0 0 6px var(--up)', animation: 'pulse 2s ease-in-out infinite',
            display: 'inline-block',
          }}/>
          &nbsp;LIVE
        </div>
        <div style={{ overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center' }}>
          <div className="ticker-track">
            {[...liveCoins, ...liveCoins].map((c, i) => (
              <div key={i} className="ticker-item" style={{ cursor: 'pointer' }} onClick={() => setSelectedSym(c.sym)}>
                <span className="sym">{c.sym}</span>
                <span className="px mono">{fmtUSD(c.price)}</span>
                <span className={'chg mono ' + (c.chgPct >= 0 ? 'up' : 'down')}>{fmtPct(c.chgPct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div className={`main layout-${layout}`}>
        {view === 'portfolio' ? (
          <PortfolioView positions={positions} balance={balance} coins={liveCoins} transactions={transactions} />
        ) : (
          <>
            <Watchlist coins={liveCoins} selectedSym={selectedSym} onSelect={setSelectedSym} />

            <div className="panel chart-panel">
              <div className="ch-instrument">
                <div className="ch-sym">
                  <div className={'icon ' + coin.icon} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11,
                  }}>{coin.mark}</div>
                  <div>
                    <div className="ticker">
                      {coin.sym}
                      <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>/USDT</span>
                    </div>
                    <div className="name">{coin.name} · {coin.kr}</div>
                  </div>
                </div>
                <div className="ch-price">
                  <div className={'big mono ' + (lastUp ? 'up' : 'down')}>{fmtUSD(coin.price)}</div>
                  <div className={'chg mono ' + (lastUp ? 'up' : 'down')}>{fmtPct(coin.chgPct)} (24h)</div>
                </div>
                <div className="ch-stats">
                  <div className="ch-stat">
                    <span className="k">24H Vol</span>
                    <span className="v">{fmtBig(coin.vol24)}</span>
                  </div>
                  <div className="ch-stat">
                    <span className="k">Mkt Cap</span>
                    <span className="v">{fmtBig(coin.mcap)}</span>
                  </div>
                </div>
              </div>

              <div className="ch-toolbar">
                <div className="ch-tf">
                  {TIMEFRAMES.map(t => (
                    <button key={t} className={'tf' + (tf === t ? ' active' : '')} onClick={() => setTf(t)}>{t}</button>
                  ))}
                </div>
                {CHART_TYPES.map(ct => (
                  <button key={ct.id} className={'ch-tool' + (chartType === ct.id ? ' active' : '')}
                          onClick={() => setChartType(ct.id)} title={ct.id}>
                    {ct.label}
                  </button>
                ))}
                <div style={{ flex: 1 }}/>
                <button className="ch-tool" title="Indicators">{I.indicator}</button>
                <button className="ch-tool" title="Drawing">{I.drawing}</button>
              </div>

              <Chart coin={scaledCoin} tf={tf} chartType={chartType}
                     avgPrice={positions.find(p => p.coin === selectedSym)?.avg_price} />
            </div>

            <Orderbook coin={coin} balance={balance} positions={positions} />
            <PositionsTable positions={positions} coins={liveCoins} transactions={transactions} onSelect={setSelectedSym} />
          </>
        )}
      </div>

      {/* ── Status Bar ── */}
      <div className="statusbar">
        <span>
          <span className="dot" style={{ background: wsConnected ? 'var(--up)' : 'var(--down)', boxShadow: wsConnected ? '0 0 6px var(--up)' : 'none' }}/>
          {wsConnected ? 'Connected' : 'Reconnecting…'}
        </span>
        <span className="spacer"/>
        {me?.email && <span>{me.email}</span>}
        <span>Mock mode · 가상 투자</span>
      </div>

      {/* ── Tweaks Panel ── */}
      <div className={'tweaks' + (showTweaks ? ' show' : '')}>
        <h4>
          Display Settings
          <span className="close" onClick={() => setShowTweaks(false)}>×</span>
        </h4>
        <div className="tweak-group">
          <div className="tweak-label">Theme</div>
          <div className="tweak-opts">
            {['midnight', 'carbon', 'ivory'].map(t => (
              <button key={t} className="tweak-opt" onClick={() => setTheme(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-group">
          <div className="tweak-label">Layout</div>
          <div className="tweak-opts">
            {(['classic', 'focus', 'dense'] as Layout[]).map(l => (
              <button key={l} className={'tweak-opt' + (layout === l ? ' active' : '')} onClick={() => setLayout(l)}>
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="tweak-group">
          <div className="tweak-label">Numbers</div>
          <div className="tweak-opts">
            {['default', 'bold', 'chip'].map(s => (
              <button key={s} className={'tweak-opt' + (numStyle === s ? ' active' : '')} onClick={() => setNums(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
