/* global React */
const { useState, useMemo } = React;

function Watchlist({ coins, selectedSym, onSelect }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filters = ["All", "★", "USDT", "Gainers", "Losers"];

  const filtered = useMemo(() => {
    let list = coins;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(c => c.sym.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (filter === "Gainers") list = [...list].sort((a, b) => b.chgPct - a.chgPct);
    if (filter === "Losers") list = [...list].sort((a, b) => a.chgPct - b.chgPct);
    if (filter === "★") list = list.slice(0, 6);
    return list;
  }, [coins, query, filter]);

  return (
    <div className="panel watchlist-panel">
      <div className="panel-head">
        <span className="title">Watchlist</span>
        <span style={{fontSize: 10, color: "var(--fg-3)"}}>관심종목</span>
        <span className="count" style={{marginLeft: "auto"}}>{filtered.length}</span>
      </div>
      <div className="wl-search">
        {I.search}
        <input placeholder="Search symbol…" value={query} onChange={e => setQuery(e.target.value)}/>
      </div>
      <div className="wl-filters">
        {filters.map(f => (
          <button key={f} className={"wl-filter" + (f === filter ? " active" : "")} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="wl-list">
        {filtered.map(c => (
          <div key={c.sym}
               className={"wl-row" + (c.sym === selectedSym ? " selected" : "")}
               onClick={() => onSelect(c.sym)}>
            <div className="wl-sym">
              <div className={"wl-icon " + c.icon}>{c.mark}</div>
              <div className="wl-name">
                <div className="s">{c.sym}<span style={{color: "var(--fg-3)", fontWeight: 400, fontSize: 10, marginLeft: 4}}>/USDT</span></div>
                <div className="n">{c.name}</div>
              </div>
            </div>
            <div className="wl-prices">
              <div className="p mono">{fmtUSD(c.price)}</div>
              <div className={"c " + (c.chgPct >= 0 ? "up" : "down")}>{fmtPct(c.chgPct)}</div>
            </div>
            <Sparkline data={c.spark} color={c.chgPct >= 0 ? "var(--up)" : "var(--down)"} width={220} height={16}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function Orderbook({ coin }) {
  const { asks, bids } = useMemo(() => MD.genOrderbook(coin.seed + 7, coin.price), [coin]);
  const maxTotal = Math.max(asks[asks.length - 1].total, bids[bids.length - 1].total);
  const [tab, setTab] = useState("book");
  const spread = asks[0].price - bids[0].price;
  const spreadPct = (spread / coin.price) * 100;
  const dec = coin.price > 100 ? 2 : 4;

  return (
    <div className="panel orderbook-panel">
      <div className="panel-head">
        <span className="title">{tab === "book" ? "Order Book" : "Recent Trades"}</span>
        <span style={{fontSize: 10, color: "var(--fg-3)"}}>{tab === "book" ? "호가" : "체결"}</span>
        <div className="tabs">
          <button className={"tab" + (tab === "book" ? " active" : "")} onClick={() => setTab("book")}>Book</button>
          <button className={"tab" + (tab === "trades" ? " active" : "")} onClick={() => setTab("trades")}>Trades</button>
        </div>
      </div>
      {tab === "book" ? (
        <>
          <div className="ob-head">
            <div className="c1">Price (USDT)</div>
            <div className="c2">Size ({coin.sym})</div>
            <div className="c3">Total</div>
          </div>
          <div className="ob-rows">
            <div className="ob-asks">
              {asks.map((r, i) => (
                <div key={"a" + i} className="ob-row ask">
                  <div className="depth" style={{ width: `${(r.total / maxTotal) * 100}%` }}/>
                  <span className="price mono">{fmtUSD(r.price, dec)}</span>
                  <span className="size mono">{fmtSize(r.size)}</span>
                  <span className="total mono">{fmtSize(r.total)}</span>
                </div>
              ))}
            </div>
            <div className="ob-spread">
              <span className={"big mono " + (coin.chgPct >= 0 ? "up" : "down")}>{fmtUSD(coin.price, dec)}</span>
              <div style={{textAlign: "right"}}>
                <div className="lbl">Spread</div>
                <div className="spr">{fmtUSD(spread, dec)} · {spreadPct.toFixed(3)}%</div>
              </div>
            </div>
            <div className="ob-bids">
              {bids.map((r, i) => (
                <div key={"b" + i} className="ob-row bid">
                  <div className="depth" style={{ width: `${(r.total / maxTotal) * 100}%` }}/>
                  <span className="price mono">{fmtUSD(r.price, dec)}</span>
                  <span className="size mono">{fmtSize(r.size)}</span>
                  <span className="total mono">{fmtSize(r.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="ob-head">
            <div className="c1">Time</div>
            <div className="c2">Price</div>
            <div className="c3">Size</div>
          </div>
          <div style={{flex: 1, overflowY: "auto"}}>
            {MD.RECENT_TRADES.map((t, i) => (
              <div key={i} className="ob-row" style={{padding: "3px 10px"}}>
                <span className="mono" style={{color: "var(--fg-3)", fontSize: 10, textAlign: "left"}}>{t.time}</span>
                <span className={"price mono " + (t.side === "buy" ? "up" : "down")} style={{textAlign: "right"}}>{fmtUSD(t.price, dec)}</span>
                <span className="size mono" style={{textAlign: "right"}}>{fmtSize(t.size)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PositionsTable({ coin }) {
  const [tab, setTab] = useState("positions");
  const P = MD.POSITIONS;
  const totalPnL = P.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="panel positions-panel">
      <div className="tbl-tabs">
        <button className={"tbl-tab" + (tab === "positions" ? " active" : "")} onClick={() => setTab("positions")}>
          Positions / 포지션 <span className="badge">{P.length}</span>
        </button>
        <button className={"tbl-tab" + (tab === "orders" ? " active" : "")} onClick={() => setTab("orders")}>
          Open Orders / 미체결 <span className="badge">{MD.OPEN_ORDERS.length}</span>
        </button>
        <button className={"tbl-tab" + (tab === "history" ? " active" : "")} onClick={() => setTab("history")}>
          History / 내역
        </button>
        <div style={{marginLeft: "auto", padding: "0 14px", display: "flex", alignItems: "center", gap: 16, fontSize: 11}}>
          <span style={{color: "var(--fg-3)"}}>Total uPnL</span>
          <span className={"mono " + (totalPnL >= 0 ? "up" : "down")} style={{fontWeight: 600}}>
            {totalPnL >= 0 ? "+" : ""}${fmtUSD(totalPnL)}
          </span>
        </div>
      </div>
      <div className="tbl-wrap">
        {tab === "positions" && (
          <table className="tbl">
            <thead><tr>
              <th>Symbol</th><th>Side</th><th>Lev</th>
              <th className="num">Size</th><th className="num">Entry</th><th className="num">Mark</th>
              <th className="num">Margin (USD)</th><th className="num">uPnL (USD)</th><th className="num">ROI %</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {P.map((p, i) => {
                const coin = MD.WATCHLIST.find(c => c.sym === p.sym) || {};
                return (
                  <tr key={i}>
                    <td><div className="sym-cell"><div className={"icon " + coin.icon}>{coin.mark}</div>{p.pair}</div></td>
                    <td><span className={"tag " + p.side}>{p.side === "long" ? "LONG" : "SHORT"}</span></td>
                    <td className="mono" style={{color: "var(--fg-2)"}}>{p.leverage}x</td>
                    <td className="num">{fmtSize(p.size)}</td>
                    <td className="num">{fmtUSD(p.entry)}</td>
                    <td className="num">{fmtUSD(p.mark)}</td>
                    <td className="num">{fmtUSD(p.margin)}</td>
                    <td className={"num " + (p.pnl >= 0 ? "up" : "down")}>{p.pnl >= 0 ? "+" : ""}{fmtUSD(p.pnl)}</td>
                    <td className={"num " + (p.pnlPct >= 0 ? "up" : "down")}>{fmtPct(p.pnlPct)}</td>
                    <td><button style={{fontSize: 10, padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 3, color: "var(--fg-1)"}}>Close</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {tab === "orders" && (
          <table className="tbl">
            <thead><tr>
              <th>Time</th><th>Pair</th><th>Side</th><th>Type</th>
              <th className="num">Price</th><th className="num">Size</th><th className="num">Filled</th><th className="num">Total</th>
              <th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {MD.OPEN_ORDERS.map((o, i) => (
                <tr key={i}>
                  <td className="mono" style={{color: "var(--fg-2)", fontSize: 11}}>{o.time}</td>
                  <td style={{color: "var(--fg-0)", fontWeight: 600}}>{o.pair}</td>
                  <td><span className={"tag " + (o.side === "buy" ? "long" : "short")}>{o.side === "buy" ? "BUY" : "SELL"}</span></td>
                  <td>{o.type}</td>
                  <td className="num">{fmtUSD(o.price)}</td>
                  <td className="num">{fmtSize(o.size)}</td>
                  <td className="num" style={{color: "var(--fg-3)"}}>{((o.filled / o.size) * 100).toFixed(1)}%</td>
                  <td className="num">{fmtUSD(o.total)}</td>
                  <td><span className="tag open">OPEN</span></td>
                  <td><button style={{fontSize: 10, padding: "3px 8px", color: "var(--down)"}}>Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "history" && (
          <div className="empty">
            <div className="mono-k">No recent fills in the last hour</div>
            <div style={{fontSize: 11}}>체결된 주문이 없습니다</div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewsPanel() {
  return (
    <div className="panel news-panel">
      <div className="panel-head">
        <span className="title">News Feed</span>
        <span style={{fontSize: 10, color: "var(--fg-3)"}}>실시간 뉴스</span>
        <div className="tabs">
          <button className="tab active">All</button>
          <button className="tab">BTC</button>
        </div>
      </div>
      <div className="news-list">
        {MD.NEWS.map((n, i) => (
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

Object.assign(window, { Watchlist, Orderbook, PositionsTable, NewsPanel });
