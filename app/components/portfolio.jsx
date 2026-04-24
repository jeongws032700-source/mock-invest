/* global React */
const { useState } = React;

function PortfolioView() {
  const P = MD.PORTFOLIO;
  return (
    <div className="overview">
      <div>
        <div style={{fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6}}>Portfolio Overview · 자산 현황</div>
        <div style={{display: "flex", alignItems: "baseline", gap: 20}}>
          <div className="mono" style={{fontSize: 40, fontWeight: 600, color: "var(--fg-0)", letterSpacing: "-0.01em"}}>
            ${fmtUSD(P.totalUSD, 2)}
          </div>
          <div className={"mono " + (P.change24hPct >= 0 ? "up" : "down")} style={{fontSize: 14}}>
            {P.change24hPct >= 0 ? "▲" : "▼"} {fmtPct(P.change24hPct)} · +${fmtUSD(P.change24hUSD)} (24h)
          </div>
        </div>
      </div>

      <div className="ov-hero">
        <div className="ov-cell">
          <span className="k">Available Balance</span>
          <span className="v mono">${fmtUSD(P.available, 2)}</span>
          <span className="sub" style={{color: "var(--fg-3)"}}>가용 잔액 · USDT</span>
        </div>
        <div className="ov-cell">
          <span className="k">In Order</span>
          <span className="v mono">${fmtUSD(P.inOrder, 2)}</span>
          <span className="sub" style={{color: "var(--fg-3)"}}>미체결 주문 잠금</span>
        </div>
        <div className="ov-cell">
          <span className="k">Unrealized PnL</span>
          <span className="v mono up">+${fmtUSD(P.unrealized, 2)}</span>
          <span className="sub up">미실현 손익 · +14.3% ROI</span>
        </div>
        <div className="ov-cell">
          <span className="k">Margin Ratio</span>
          <span className="v mono">24.8%</span>
          <span className="sub" style={{color: "var(--fg-3)"}}>건전 · Healthy</span>
        </div>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "2fr 1fr", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: "var(--radius-m)", overflow: "hidden"}}>
        <div style={{background: "var(--bg-1)", padding: 20}}>
          <div style={{display: "flex", justifyContent: "space-between", marginBottom: 16}}>
            <div>
              <div style={{fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)"}}>Equity Curve · 30D</div>
              <div className="mono" style={{fontSize: 18, color: "var(--fg-0)", marginTop: 4}}>+$42,180.44</div>
            </div>
            <div style={{display: "flex", gap: 4}}>
              {["7D","30D","90D","1Y","ALL"].map((p, i) => (
                <button key={p} style={{
                  padding: "4px 10px", fontSize: 10, fontFamily: "var(--mono)",
                  color: i === 1 ? "var(--fg-0)" : "var(--fg-3)",
                  background: i === 1 ? "var(--bg-3)" : "transparent",
                  borderRadius: 3, border: 0
                }}>{p}</button>
              ))}
            </div>
          </div>
          <EquityCurve/>
        </div>
        <div style={{background: "var(--bg-1)", padding: 20}}>
          <div style={{fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 16}}>Allocation · 자산 배분</div>
          <Allocation alloc={P.allocation}/>
        </div>
      </div>
    </div>
  );
}

function EquityCurve() {
  const data = MD.genSpark(42, 90);
  const w = 600, h = 160;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h * 0.9 - 8}`).join(" ");
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

function Allocation({ alloc }) {
  return (
    <div>
      {alloc.map(a => (
        <div key={a.sym} style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 10}}>
          <div className={"wl-icon " + a.icon} style={{width: 20, height: 20, fontSize: 10}}>{a.sym[0]}</div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3}}>
              <span style={{color: "var(--fg-0)", fontWeight: 500}}>{a.sym}</span>
              <span className="mono" style={{color: "var(--fg-2)"}}>{a.pct.toFixed(1)}%</span>
            </div>
            <div style={{height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden"}}>
              <div style={{width: `${a.pct}%`, height: "100%", background: "var(--fg-1)"}}/>
            </div>
            <div className="mono" style={{fontSize: 10, color: "var(--fg-3)", marginTop: 2}}>${fmtUSD(a.usd, 0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

window.PortfolioView = PortfolioView;
