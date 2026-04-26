'use client';
import { useEffect } from 'react';
import { usePriceStore } from '@/lib/priceStore';
import { WATCHLIST } from '@/lib/market-data';

const STREAMS = WATCHLIST.map(c => `${c.sym.toLowerCase()}usdt@miniTicker`).join('/');
const WS_URL  = `wss://stream.binance.com:9443/stream?streams=${STREAMS}`;

export function MarketStream() {
  const setPrice    = usePriceStore(s => s.setPrice);
  const setConnected = usePriceStore(s => s.setConnected);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen   = () => setConnected(true);

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const d   = msg.data;
        if (!d || d.e !== '24hrMiniTicker') return;
        const sym    = d.s.replace('USDT', '');
        const price  = parseFloat(d.c);
        const open   = parseFloat(d.o);
        const vol24  = parseFloat(d.q);
        const chgPct = open > 0 ? ((price - open) / open) * 100 : 0;
        setPrice(sym, { price, chgPct, vol24 });
      };

      ws.onerror  = () => ws.close();
      ws.onclose  = () => { setConnected(false); retryTimeout = setTimeout(connect, 3000); };
    }

    connect();
    return () => { clearTimeout(retryTimeout); ws?.close(); };
  }, [setPrice, setConnected]);

  return null;
}
