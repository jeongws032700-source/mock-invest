export interface Candle {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

export interface Coin {
  sym: string; pair: string; name: string; kr: string;
  icon: string; mark: string;
  price: number; chgPct: number; vol24: number; mcap: number;
  seed: number; trend: number;
  spark: number[];
  candles: Candle[];
}

export interface OrderbookEntry { price: number; size: number; total: number; }
export interface Position {
  sym: string; pair: string; side: 'long' | 'short';
  size: number; entry: number; mark: number;
  margin: number; pnl: number; pnlPct: number; leverage: number;
}
export interface OpenOrder {
  time: string; pair: string; side: 'buy' | 'sell';
  type: string; price: number; size: number; filled: number; total: number;
}
export interface Trade { time: string; price: number; size: number; side: 'buy' | 'sell'; }
export interface NewsItem { time: string; src: string; ttl: string; tags: string[]; }
export interface Portfolio {
  totalUSD: number; change24hUSD: number; change24hPct: number;
  available: number; inOrder: number; unrealized: number;
  allocation: { sym: string; usd: number; pct: number; icon: string }[];
}

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function genCandles(seed: number, n: number, p0: number, volBase: number, trend = 0): Candle[] {
  const rnd = seeded(seed);
  const candles: Candle[] = [];
  let p = p0;
  for (let i = 0; i < n; i++) {
    const vol = p * (0.004 + rnd() * 0.012);
    const drift = trend * p * 0.0008;
    const open = p;
    const close = open + (rnd() - 0.5 + trend * 0.15) * vol * 2 + drift;
    const high = Math.max(open, close) + rnd() * vol;
    const low = Math.min(open, close) - rnd() * vol;
    const volume = volBase * (0.5 + rnd() * 1.5);
    candles.push({ t: i, o: open, h: high, l: low, c: close, v: volume });
    p = close;
  }
  return candles;
}

export function genSpark(seed: number, n = 40): number[] {
  const rnd = seeded(seed);
  const pts: number[] = [];
  let v = 50;
  for (let i = 0; i < n; i++) { v += (rnd() - 0.5) * 10; pts.push(v); }
  return pts;
}

export function genOrderbook(seed: number, midPrice: number): { asks: OrderbookEntry[]; bids: OrderbookEntry[] } {
  const rnd = seeded(seed);
  const asks: OrderbookEntry[] = [], bids: OrderbookEntry[] = [];
  const tickSize = midPrice > 100 ? 0.1 : midPrice > 1 ? 0.001 : 0.00001;
  let askP = midPrice + tickSize * 2, bidP = midPrice - tickSize * 2;
  let askTotal = 0, bidTotal = 0;
  for (let i = 0; i < 14; i++) {
    const aSize = 0.05 + rnd() * (i < 3 ? 0.8 : 2.5);
    const bSize = 0.05 + rnd() * (i < 3 ? 0.8 : 2.5);
    askTotal += aSize; bidTotal += bSize;
    asks.push({ price: askP, size: aSize, total: askTotal });
    bids.push({ price: bidP, size: bSize, total: bidTotal });
    askP += tickSize * (1 + Math.floor(rnd() * 4));
    bidP -= tickSize * (1 + Math.floor(rnd() * 4));
  }
  return { asks, bids };
}

function buildWatchlist(): Coin[] {
  const raw = [
    { sym: "BTC", pair: "BTC/USDT", name: "Bitcoin",       kr: "비트코인",   icon: "ico-btc",  mark: "₿", price: 98442.17, chgPct:  2.34, vol24: 28400000000, mcap: 1950000000000, seed: 101, trend:  1   },
    { sym: "ETH", pair: "ETH/USDT", name: "Ethereum",      kr: "이더리움",   icon: "ico-eth",  mark: "Ξ", price:  3421.88, chgPct:  1.52, vol24: 14200000000, mcap:  412000000000, seed: 201, trend:  0.5 },
    { sym: "SOL", pair: "SOL/USDT", name: "Solana",        kr: "솔라나",     icon: "ico-sol",  mark: "◎", price:   218.44, chgPct:  4.71, vol24:  3800000000, mcap:  103000000000, seed: 301, trend:  1.2 },
    { sym: "BNB", pair: "BNB/USDT", name: "BNB",           kr: "바이낸스",   icon: "ico-bnb",  mark: "B", price:   684.12, chgPct: -0.48, vol24:  1200000000, mcap:   98000000000, seed: 401, trend: -0.2 },
    { sym: "XRP", pair: "XRP/USDT", name: "Ripple",        kr: "리플",       icon: "ico-xrp",  mark: "X", price:     2.388,chgPct: -1.82, vol24:  4200000000, mcap:  138000000000, seed: 501, trend: -0.6 },
    { sym: "DOGE",pair: "DOGE/USDT",name: "Dogecoin",      kr: "도지코인",   icon: "ico-doge", mark: "D", price:    0.3422,chgPct:  3.12, vol24:  2800000000, mcap:   50000000000, seed: 601, trend:  0.8 },
    { sym: "ADA", pair: "ADA/USDT", name: "Cardano",       kr: "에이다",     icon: "ico-ada",  mark: "A", price:    0.9871,chgPct:  0.74, vol24:   880000000, mcap:   35000000000, seed: 701, trend:  0.2 },
    { sym: "AVAX",pair: "AVAX/USDT",name: "Avalanche",     kr: "아발란체",   icon: "ico-avax", mark: "A", price:    42.18, chgPct: -2.14, vol24:   620000000, mcap:   17000000000, seed: 801, trend: -0.7 },
    { sym: "LINK",pair: "LINK/USDT",name: "Chainlink",     kr: "체인링크",   icon: "ico-link", mark: "L", price:    24.82, chgPct:  5.88, vol24:  1400000000, mcap:   16200000000, seed: 901, trend:  1.4 },
    { sym: "MATIC",pair:"MATIC/USDT",name:"Polygon",       kr: "폴리곤",     icon: "ico-matic",mark: "M", price:    0.5124,chgPct: -0.92, vol24:   380000000, mcap:    5100000000, seed:1001, trend: -0.3 },
    { sym: "DOT", pair: "DOT/USDT", name: "Polkadot",      kr: "폴카닷",     icon: "ico-dot",  mark: "P", price:     7.412,chgPct:  1.22, vol24:   290000000, mcap:   11000000000, seed:1101, trend:  0.4 },
    { sym: "ATOM",pair: "ATOM/USDT",name: "Cosmos",        kr: "코스모스",   icon: "ico-atom", mark: "C", price:     6.88, chgPct:  2.04, vol24:   210000000, mcap:    2700000000, seed:1201, trend:  0.6 },
    { sym: "ARB", pair: "ARB/USDT", name: "Arbitrum",      kr: "아비트럼",   icon: "ico-arb",  mark: "A", price:     0.842,chgPct: -3.41, vol24:   480000000, mcap:    4000000000, seed:1301, trend: -1   },
    { sym: "OP",  pair: "OP/USDT",  name: "Optimism",      kr: "옵티미즘",   icon: "ico-op",   mark: "O", price:     1.942,chgPct:  0.42, vol24:   320000000, mcap:    2300000000, seed:1401, trend:  0.1 },
    { sym: "NEAR",pair: "NEAR/USDT",name: "NEAR Protocol", kr: "니어",       icon: "ico-near", mark: "N", price:     5.628,chgPct:  3.77, vol24:   410000000, mcap:    6200000000, seed:1501, trend:  1   },
    { sym: "LTC", pair: "LTC/USDT", name: "Litecoin",      kr: "라이트코인", icon: "ico-ltc",  mark: "Ł", price:   108.44, chgPct: -0.18, vol24:   420000000, mcap:    8200000000, seed:1601, trend:  0   },
  ];
  return raw.map(w => {
    const spark = genSpark(w.seed, 36);
    let candles = genCandles(w.seed, 120, w.price * (1 - w.chgPct / 200), w.price * 0.01, w.trend);
    const last = candles[candles.length - 1];
    const shift = w.price - last.c;
    candles = candles.map((c, i) => ({
      ...c,
      o: c.o + shift * (i / candles.length),
      c: c.c + shift * (i / candles.length),
      h: c.h + shift * (i / candles.length),
      l: c.l + shift * (i / candles.length),
    }));
    candles[candles.length - 1].c = w.price;
    candles[candles.length - 1].h = Math.max(candles[candles.length - 1].h, w.price);
    candles[candles.length - 1].l = Math.min(candles[candles.length - 1].l, w.price);
    return { ...w, spark, candles };
  });
}

export const WATCHLIST: Coin[] = buildWatchlist();

export const POSITIONS: Position[] = [
  { sym: "BTC",  pair: "BTC-PERP",  side: "long",  size: 0.482, entry: 94120.50, mark: 98442.17, margin: 22692.02, pnl: 2083.56, pnlPct:  9.17, leverage: 2 },
  { sym: "ETH",  pair: "ETH-PERP",  side: "long",  size: 8.20,  entry:  3288.40, mark:  3421.88, margin: 13484.51, pnl: 1094.54, pnlPct:  8.12, leverage: 2 },
  { sym: "SOL",  pair: "SOL-PERP",  side: "long",  size: 124.0, entry:   201.80, mark:   218.44, margin: 10709.56, pnl: 2063.36, pnlPct: 19.28, leverage: 2 },
  { sym: "AVAX", pair: "AVAX-PERP", side: "short", size: 148.0, entry:    45.20, mark:    42.18, margin:  3347.28, pnl:  446.96, pnlPct: 13.35, leverage: 2 },
  { sym: "LINK", pair: "LINK-PERP", side: "long",  size: 420.0, entry:    22.14, mark:    24.82, margin:  4649.40, pnl: 1125.60, pnlPct: 24.20, leverage: 2 },
];

export const OPEN_ORDERS: OpenOrder[] = [
  { time: "14:22:08", pair: "BTC/USDT",  side: "buy",  type: "Limit", price: 96800.00, size: 0.15, filled: 0,    total: 14520.00 },
  { time: "14:18:42", pair: "ETH/USDT",  side: "sell", type: "Limit", price:  3580.00, size: 4.0,  filled: 0,    total: 14320.00 },
  { time: "13:55:11", pair: "SOL/USDT",  side: "buy",  type: "Stop",  price:   205.00, size: 80,   filled: 0,    total: 16400.00 },
  { time: "13:32:50", pair: "LINK/USDT", side: "sell", type: "Limit", price:    26.40, size: 180,  filled: 0.28, total:  4752.00 },
];

export const RECENT_TRADES: Trade[] = [
  { time: "14:31:22", price: 98442.17, size: 0.0428, side: "buy"  },
  { time: "14:31:20", price: 98440.80, size: 0.1120, side: "sell" },
  { time: "14:31:18", price: 98441.50, size: 0.0082, side: "buy"  },
  { time: "14:31:16", price: 98442.17, size: 0.2440, side: "buy"  },
  { time: "14:31:14", price: 98440.20, size: 0.0180, side: "sell" },
  { time: "14:31:11", price: 98442.80, size: 0.0912, side: "buy"  },
  { time: "14:31:08", price: 98441.00, size: 0.0050, side: "sell" },
  { time: "14:31:05", price: 98443.10, size: 0.3208, side: "buy"  },
  { time: "14:31:02", price: 98440.44, size: 0.0614, side: "sell" },
  { time: "14:30:58", price: 98442.17, size: 0.1242, side: "buy"  },
  { time: "14:30:54", price: 98439.80, size: 0.0824, side: "sell" },
  { time: "14:30:51", price: 98441.12, size: 0.0302, side: "buy"  },
];

export const NEWS: NewsItem[] = [
  { time: "14:28", src: "Bloomberg",    ttl: "BlackRock Bitcoin ETF 순유입 8일 연속, 총 $4.2B 유입",           tags: ["BTC", "ETF"]        },
  { time: "14:16", src: "CoinDesk",     ttl: "Solana 활성 주소수 월간 최고치 경신 — 2.14M addresses",         tags: ["SOL", "ON-CHAIN"]   },
  { time: "13:54", src: "Reuters",      ttl: "Fed 의장 발언: 금리 인하 시점 재조정 가능성 시사",               tags: ["MACRO", "RATES"]    },
  { time: "13:32", src: "The Block",    ttl: "Chainlink CCIP, 주요 은행 4곳과 토큰화 파일럿 개시",            tags: ["LINK"]              },
  { time: "13:08", src: "Coinbase",     ttl: "Ethereum L2 TVL 처음으로 $85B 돌파",                            tags: ["ETH", "L2"]         },
  { time: "12:44", src: "Binance",      ttl: "Avalanche 네트워크 업그레이드, 수수료 40% 감소",                 tags: ["AVAX"]              },
  { time: "12:20", src: "Decrypt",      ttl: "SEC, 알트코인 ETF 신청 3건 추가 검토 단계 진입",                 tags: ["REGULATION"]        },
  { time: "11:58", src: "Cointelegraph",ttl: "MicroStrategy, BTC 3,140개 추가 매입 공시",                     tags: ["BTC", "TREASURY"]   },
];

export const PORTFOLIO: Portfolio = {
  totalUSD: 548412.88,
  change24hUSD: 8742.14,
  change24hPct: 1.62,
  available: 42180.22,
  inOrder: 18400.00,
  unrealized: 6814.02,
  allocation: [
    { sym: "BTC",    usd: 218400, pct: 39.8, icon: "ico-btc"  },
    { sym: "ETH",    usd: 142800, pct: 26.0, icon: "ico-eth"  },
    { sym: "SOL",    usd:  78200, pct: 14.3, icon: "ico-sol"  },
    { sym: "LINK",   usd:  42100, pct:  7.7, icon: "ico-link" },
    { sym: "USDT",   usd:  42180, pct:  7.7, icon: "ico-xrp"  },
    { sym: "Others", usd:  24732, pct:  4.5, icon: "ico-dot"  },
  ],
};
