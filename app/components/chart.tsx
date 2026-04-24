'use client';
import { useState, useRef, useEffect } from 'react';
import { fmtUSD, fmtBig, fmtPct } from './common';
import type { Coin } from '@/lib/market-data';

const TF_LABELS: Record<string, (i: number, len: number) => string> = {
  '1m':  (i, n) => `${14 - Math.floor((n - 1 - i) / 60)}:${String(Math.floor((60 - (n - 1 - i) % 60)) % 60).padStart(2, '0')}`,
  '5m':  (i, n) => `${14 - Math.floor((n - 1 - i) * 5 / 60)}:${String(Math.floor((60 - ((n - 1 - i) * 5) % 60)) % 60).padStart(2, '0')}`,
  '15m': (i, n) => `${Math.max(0, 14 - Math.floor((n - 1 - i) * 15 / 60))}:00`,
  '1H':  (i, n) => `${Math.max(0, 14 - (n - 1 - i))}:00`,
  '4H':  (i, n) => `Apr ${Math.max(1, 18 - Math.floor((n - 1 - i) / 6))}`,
  '1D':  (i, n) => `Apr ${Math.max(1, 18 - (n - 1 - i))}`,
  '1W':  (i, n) => `W${Math.max(1, 16 - (n - 1 - i))}`,
};

export function Chart({ coin, tf, chartType }: { coin: Coin; tf: string; chartType: string }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dim, setDim]   = useState({ w: 800, h: 400 });
  const [hover, setHover] = useState<{ idx: number; mouseX: number; mouseY: number; price: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDim({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const candles = coin.candles;
  const { w, h } = dim;
  const padT = 10, padB = 28, padR = 0, padL = 4;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const volH  = 50;
  const priceH = plotH - volH - 4;

  const prices = candles.flatMap(c => [c.h, c.l]);
  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const pRange = pMax - pMin || 1;
  const pad = pRange * 0.08;
  const yMin = pMin - pad, yMax = pMax + pad;
  const yRange = yMax - yMin;

  const vMax = Math.max(...candles.map(c => c.v));
  const cw    = plotW / candles.length;
  const bodyW = Math.max(1, cw * 0.65);

  const xOf  = (i: number) => padL + i * cw + cw / 2;
  const yOf  = (p: number) => padT + (1 - (p - yMin) / yRange) * priceH;
  const yVol = (v: number) => padT + priceH + 4 + volH - (v / vMax) * volH;

  const ticks: { p: number; y: number }[] = [];
  for (let i = 0; i <= 6; i++) {
    const p = yMin + (yRange * i) / 6;
    ticks.push({ p, y: yOf(p) });
  }

  const ma = candles.map((_, i) => {
    const slice = candles.slice(Math.max(0, i - 19), i + 1);
    return slice.reduce((s, c) => s + c.c, 0) / slice.length;
  });

  const labelFn = TF_LABELS[tf] ?? TF_LABELS['1H'];
  const xLabels = Array.from({ length: 6 }, (_, i) => {
    const idx = Math.floor((candles.length - 1) * (i / 5));
    return { idx, x: xOf(idx), label: labelFn(idx, candles.length) };
  });

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < padL || x > padL + plotW || y < padT || y > padT + plotH) { setHover(null); return; }
    const idx = Math.max(0, Math.min(candles.length - 1, Math.floor((x - padL) / cw)));
    const price = yMin + (1 - (y - padT) / priceH) * yRange;
    setHover({ idx, mouseX: x, mouseY: y, price });
  };

  const last   = candles[candles.length - 1];
  const lastUp = last.c >= last.o;
  const dec    = coin.price > 100 ? 2 : 4;

  return (
    <div className="ch-wrap" ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <div className="ch-svg-wrap">
        <svg ref={svgRef} className="ch-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseMove={onMove}>
          {/* Grid */}
          {ticks.map((t, i) => (
            <line key={`g${i}`} x1={padL} x2={padL + plotW} y1={t.y} y2={t.y}
                  stroke="var(--line-soft)" strokeWidth="1" strokeDasharray="1 3" opacity="0.5"/>
          ))}
          {xLabels.map((l, i) => (
            <line key={`xl${i}`} x1={l.x} x2={l.x} y1={padT} y2={padT + plotH}
                  stroke="var(--line-soft)" strokeWidth="1" strokeDasharray="1 3" opacity="0.4"/>
          ))}

          {/* Area */}
          {chartType === 'area' && (() => {
            const pts = candles.map((c, i) => `${xOf(i)},${yOf(c.c)}`).join(' ');
            return (
              <g>
                <polygon points={`${padL},${padT + priceH} ${pts} ${padL + plotW},${padT + priceH}`} fill="var(--up-soft)"/>
                <polyline points={pts} fill="none" stroke="var(--up)" strokeWidth="1.5"/>
              </g>
            );
          })()}

          {/* Candles */}
          {chartType === 'candle' && candles.map((c, i) => {
            const up  = c.c >= c.o;
            const col = up ? 'var(--up)' : 'var(--down)';
            const x   = xOf(i);
            return (
              <g key={`c${i}`}>
                <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={col} strokeWidth="1"/>
                <rect x={x - bodyW / 2} y={yOf(Math.max(c.o, c.c))}
                      width={bodyW} height={Math.max(1, Math.abs(yOf(c.o) - yOf(c.c)))} fill={col}/>
              </g>
            );
          })}

          {/* Bars */}
          {chartType === 'bars' && candles.map((c, i) => {
            const up  = c.c >= c.o;
            const col = up ? 'var(--up)' : 'var(--down)';
            const x   = xOf(i);
            return (
              <g key={`b${i}`}>
                <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={col} strokeWidth="1.5"/>
                <line x1={x - bodyW / 2} x2={x} y1={yOf(c.o)} y2={yOf(c.o)} stroke={col} strokeWidth="1.5"/>
                <line x1={x} x2={x + bodyW / 2} y1={yOf(c.c)} y2={yOf(c.c)} stroke={col} strokeWidth="1.5"/>
              </g>
            );
          })}

          {/* MA */}
          {chartType !== 'area' && (
            <polyline points={ma.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
                      fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.85"/>
          )}

          {/* Volume */}
          {candles.map((c, i) => {
            const col = c.c >= c.o ? 'var(--up)' : 'var(--down)';
            const y   = yVol(c.v);
            return (
              <rect key={`v${i}`} x={xOf(i) - bodyW / 2} y={y}
                    width={bodyW} height={padT + priceH + 4 + volH - y} fill={col} opacity="0.4"/>
            );
          })}

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text key={`xt${i}`} x={l.x} y={h - 10}
                  fontFamily="var(--mono)" fontSize="10" fill="var(--fg-3)" textAnchor="middle">
              {l.label}
            </text>
          ))}

          {/* Crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line x1={xOf(hover.idx)} x2={xOf(hover.idx)} y1={padT} y2={padT + plotH}
                    stroke="var(--fg-2)" strokeDasharray="2 3" opacity="0.6"/>
              <line x1={padL} x2={padL + plotW} y1={hover.mouseY} y2={hover.mouseY}
                    stroke="var(--fg-2)" strokeDasharray="2 3" opacity="0.6"/>
              <circle cx={xOf(hover.idx)} cy={yOf(candles[hover.idx].c)} r="3"
                      fill="var(--accent)" stroke="var(--bg-0)" strokeWidth="1.5"/>
            </g>
          )}
        </svg>

        {/* OHLC tooltip */}
        {hover && (() => {
          const c  = candles[hover.idx];
          const up = c.c >= c.o;
          const chg = ((c.c - c.o) / c.o) * 100;
          return (
            <div className="ch-tooltip" style={{ display: 'block' }}>
              <div className="row"><span className="k">{labelFn(hover.idx, candles.length)}</span></div>
              <div style={{ height: 4 }}/>
              <div className="row"><span className="k">O</span><span className="v">{fmtUSD(c.o, dec)}</span></div>
              <div className="row"><span className="k">H</span><span className="v up">{fmtUSD(c.h, dec)}</span></div>
              <div className="row"><span className="k">L</span><span className="v down">{fmtUSD(c.l, dec)}</span></div>
              <div className="row"><span className="k">C</span><span className="v" style={{ color: up ? 'var(--up)' : 'var(--down)' }}>{fmtUSD(c.c, dec)}</span></div>
              <div className="row"><span className="k">Vol</span><span className="v">{fmtBig(c.v)}</span></div>
              <div className="row"><span className="k">Chg</span><span className={'v ' + (up ? 'up' : 'down')}>{fmtPct(chg)}</span></div>
            </div>
          );
        })()}
      </div>

      {/* Price axis */}
      <div className="ch-price-axis">
        {ticks.map((t, i) => (
          <div key={i} className="tick" style={{ top: t.y }}>{fmtUSD(t.p, dec)}</div>
        ))}
        <div className={'ch-last-price ' + (lastUp ? '' : 'down')} style={{ top: yOf(last.c) }}>
          {fmtUSD(last.c, dec)}
        </div>
        {hover && (
          <div className="ch-yaxis-label" style={{ display: 'block', top: hover.mouseY, background: 'var(--bg-3)' }}>
            {fmtUSD(hover.price, dec)}
          </div>
        )}
      </div>
    </div>
  );
}
