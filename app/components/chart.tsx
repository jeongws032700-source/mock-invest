'use client';
import { useState, useRef, useEffect } from 'react';
import { fmtUSD, fmtBig, fmtPct } from './common';
import type { Coin } from '@/lib/market-data';

const DEFAULT_VISIBLE = 140;
const MIN_VISIBLE = 24;
const MAX_RIGHT_PADDING = 10;

const TF_FALLBACK_STEP: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1H': 60 * 60_000,
  '4H': 4 * 60 * 60_000,
  '1D': 24 * 60 * 60_000,
  '1W': 7 * 24 * 60 * 60_000,
};
const MOCK_LABEL_EPOCH = Date.UTC(2026, 3, 27, 14, 0, 0);

export function Chart({ coin, tf, chartType, avgPrice }: { coin: Coin; tf: string; chartType: string; avgPrice?: number }) {
  const svgRef      = useRef<SVGSVGElement>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);
  const priceAxisRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 800, h: 400 });
  const [hover, setHover] = useState<{ idx: number; mouseX: number; mouseY: number; price: number } | null>(null);

  // pan & zoom state (xStart is float for smooth drag)
  const [xStart, setXStart] = useState(0.0);
  const [xCount, setXCount] = useState(0); // 0 = show all

  // refs for stale-closure-free access inside useEffect wheel handlers
  const xStartRef = useRef(0.0);
  const xCountRef = useRef(0);
  const [yPan,   setYPan]   = useState(0);
  const [yZoom,  setYZoom]  = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ clientX: number; clientY: number; xStart: number; yPan: number; xCountSnap: number } | null>(null);

  useEffect(() => {
    xStartRef.current = xStart;
  }, [xStart]);

  useEffect(() => {
    xCountRef.current = xCount;
  }, [xCount]);

  useEffect(() => {
    const stopDrag = () => {
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('blur', stopDrag);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('blur', stopDrag);
    };
  }, []);

  const allCandles = coin.candles;
  const defaultCount = Math.min(DEFAULT_VISIBLE, allCandles.length);

  // reset when coin/tf changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setXStart(Math.max(0, allCandles.length - defaultCount));
    setXCount(defaultCount);
    setYPan(0);
    setYZoom(1);
    setHover(null);
  }, [coin.sym, tf, allCandles.length, defaultCount]);

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

  // non-passive wheel for x-zoom — keeps the right edge (latest visible candle) fixed
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setHover(null);
      const all = coin.candles.length;
      const currentCount = xCountRef.current > 0 ? xCountRef.current : all;
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const newCount = Math.round(Math.max(MIN_VISIBLE, Math.min(all, currentCount * factor)));
      // keep right edge fixed: rightEdge = xStart + currentCount
      const rightEdge = xStartRef.current + currentCount;
      const newStart = Math.max(0, rightEdge - newCount);
      setXCount(newCount);
      setXStart(newStart);
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, [coin.candles.length]);

  // Price axis wheel → Y zoom
  useEffect(() => {
    const el = priceAxisRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setYZoom(prev => Math.max(0.2, Math.min(20, prev * (e.deltaY > 0 ? 0.87 : 1.15))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const effectiveCount = xCount > 0 ? xCount : allCandles.length;

  // Slot-based layout: effectiveCount slots on screen, xStart is the candle index at slot 0 (float).
  // No right clamp — allows panning into empty future space.
  const floorStart = Math.floor(xStart);
  const frac = xStart - floorStart; // sub-slot fractional offset for smooth drag

  // Get candle for slot i (null = empty/future space)
  const candleAt = (i: number) => {
    const idx = floorStart + i;
    return (idx >= 0 && idx < allCandles.length) ? allCandles[idx] : null;
  };

  // Visible (non-null) candles for price range calculation
  const visibleCandles = Array.from({ length: effectiveCount }, (_, i) => candleAt(i)).filter(Boolean) as (typeof allCandles[0])[];

  const { w, h } = dim;
  const padT = 14, padB = 30, padR = 0, padL = 8;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const volH  = Math.max(42, Math.min(58, h * 0.16));
  const priceH = plotH - volH - 10;

  const prices = visibleCandles.flatMap(c => [c.h, c.l]);
  const pMin = prices.length ? Math.min(...prices) : 0;
  const pMax = prices.length ? Math.max(...prices) : 1;
  const pRange = pMax - pMin || 1;
  const basePad = pRange * 0.12;
  const autoCenter = (pMin - basePad + pMax + basePad) / 2;
  const autoHalf   = (pMax + basePad - (pMin - basePad)) / 2;
  const yHalf   = autoHalf / yZoom;
  const yCenter = autoCenter + yPan;
  const yMin = yCenter - yHalf;
  const yMax = yCenter + yHalf;
  const yRange = yMax - yMin;

  const vMax = Math.max(...visibleCandles.map(c => c.v), 1);
  const cw    = plotW / effectiveCount;  // always based on effectiveCount
  const bodyW = Math.max(2, Math.min(12, cw * 0.58));

  // Slot i's x position, shifted by fractional sub-candle offset for smooth scrolling
  const xOf  = (i: number) => padL + (i - frac) * cw + cw / 2;
  const yOf  = (p: number) => padT + (1 - (p - yMin) / yRange) * priceH;
  const volumeTop = padT + priceH + 10;
  const yVol = (v: number) => volumeTop + volH - (v / vMax) * volH;

  const ticks: { p: number; y: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const p = yMin + (yRange * i) / 4;
    ticks.push({ p, y: yOf(p) });
  }

  // MA computed over all candles, indexed by global candle index
  const maAll = allCandles.map((_, i) => {
    const slice = allCandles.slice(Math.max(0, i - 19), i + 1);
    return slice.reduce((s, c) => s + c.c, 0) / slice.length;
  });

  const fallbackStep = TF_FALLBACK_STEP[tf] ?? TF_FALLBACK_STEP['1H'];
  const formatLabel = (slotIdx: number) => {
    const candleIdx = floorStart + slotIdx;
    const candle = candleAt(slotIdx);
    const rawTime = candle?.t;
    const time = rawTime && rawTime > 1_000_000_000
      ? rawTime
      : MOCK_LABEL_EPOCH - Math.max(0, allCandles.length - 1 - candleIdx) * fallbackStep;
    const date = new Date(time);

    if (tf === '1D' || tf === '1W') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const xLabelCount = w < 560 ? 4 : 6;
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const slotIdx   = Math.floor((effectiveCount - 1) * (i / (xLabelCount - 1)));
    const candleIdx = floorStart + slotIdx;
    return { slotIdx, candleIdx, x: xOf(slotIdx), label: formatLabel(slotIdx) };
  });

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { clientX: e.clientX, clientY: e.clientY, xStart, yPan, xCountSnap: effectiveCount };
    setIsDragging(true);
    setHover(null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      if (e.buttons === 0) {
        dragRef.current = null;
        setIsDragging(false);
        return;
      }

      const dx = e.clientX - dragRef.current.clientX;
      const dy = e.clientY - dragRef.current.clientY;
      const candlesPerPixel = dragRef.current.xCountSnap / plotW;
      const maxStart = Math.max(0, allCandles.length - MIN_VISIBLE + MAX_RIGHT_PADDING);
      const newStart = Math.max(0, Math.min(maxStart, dragRef.current.xStart - dx * candlesPerPixel));
      const pricePerPixel = (yHalf * 2) / priceH;
      setXStart(newStart);
      setYPan(dragRef.current.yPan + dy * pricePerPixel);
      return;
    }
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < padL || x > padL + plotW || y < padT || y > padT + plotH) { setHover(null); return; }
    const slotIdx = Math.max(0, Math.min(effectiveCount - 1, Math.floor((x - padL + frac * cw) / cw)));
    const price   = yMin + (1 - (y - padT) / priceH) * yRange;
    setHover({ idx: slotIdx, mouseX: x, mouseY: y, price });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  };

  const onDoubleClick = () => {
    setXStart(Math.max(0, allCandles.length - defaultCount));
    setXCount(defaultCount);
    setYPan(0); setYZoom(1);
  };

  const lastCandle = visibleCandles.length ? visibleCandles[visibleCandles.length - 1] : allCandles[allCandles.length - 1];
  const lastUp = lastCandle.c >= lastCandle.o;
  const dec    = coin.price > 100 ? 2 : 4;
  const lastY = yOf(lastCandle.c);
  const tooltipStyle = hover
    ? {
        display: 'block',
        left: Math.min(Math.max(hover.mouseX + 14, 8), Math.max(8, w - 184)),
        top: Math.min(Math.max(hover.mouseY + 14, 8), Math.max(8, h - 152)),
      }
    : undefined;

  return (
    <div className="ch-wrap"
         onMouseLeave={() => { if (!isDragging) setHover(null); }}>
      <div className="ch-svg-wrap" ref={wrapRef}>
        <svg ref={svgRef} className="ch-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
             onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
             onPointerCancel={onPointerUp}
             onDoubleClick={onDoubleClick}
             style={{ cursor: isDragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}>
          <defs>
            <linearGradient id={`area-${coin.sym}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up)" stopOpacity="0.18"/>
              <stop offset="72%" stopColor="var(--up)" stopOpacity="0.04"/>
              <stop offset="100%" stopColor="var(--up)" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Grid */}
          {ticks.map((t, i) => (
            <line key={`g${i}`} x1={padL} x2={padL + plotW} y1={t.y} y2={t.y}
                  stroke="var(--line-soft)" strokeWidth="1" opacity={i === 0 || i === ticks.length - 1 ? '0.32' : '0.55'}/>
          ))}
          {xLabels.map((l, i) => (
            <line key={`xl${i}`} x1={l.x} x2={l.x} y1={padT} y2={padT + plotH}
                  stroke="var(--line-soft)" strokeWidth="1" opacity={i === 0 || i === xLabels.length - 1 ? '0.18' : '0.32'}/>
          ))}
          <line x1={padL} x2={padL + plotW} y1={volumeTop - 6} y2={volumeTop - 6}
                stroke="var(--line-soft)" strokeWidth="1" opacity="0.65"/>

          {/* Area */}
          {chartType === 'area' && (() => {
            const pts = Array.from({ length: effectiveCount }, (_, i) => {
              const c = candleAt(i);
              return c ? `${xOf(i)},${yOf(c.c)}` : null;
            }).filter(Boolean).join(' ');
            return pts ? (
              <g>
                <polygon points={`${padL},${padT + priceH} ${pts} ${padL + plotW},${padT + priceH}`} fill={`url(#area-${coin.sym})`}/>
                <polyline points={pts} fill="none" stroke="var(--up)" strokeWidth="1.6" strokeLinejoin="round"/>
              </g>
            ) : null;
          })()}

          {/* Candles */}
          {chartType === 'candle' && Array.from({ length: effectiveCount }, (_, i) => {
            const c = candleAt(i);
            if (!c) return null;
            const up  = c.c >= c.o;
            const col = up ? 'var(--up)' : 'var(--down)';
            const x   = xOf(i);
            return (
              <g key={`c${floorStart + i}`}>
                <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={col} strokeWidth="1.15" opacity="0.95"/>
                <rect x={x - bodyW / 2} y={yOf(Math.max(c.o, c.c))}
                      width={bodyW} height={Math.max(1.5, Math.abs(yOf(c.o) - yOf(c.c)))} fill={col} rx={Math.min(1.5, bodyW / 3)}/>
              </g>
            );
          })}

          {/* Bars */}
          {chartType === 'bars' && Array.from({ length: effectiveCount }, (_, i) => {
            const c = candleAt(i);
            if (!c) return null;
            const up  = c.c >= c.o;
            const col = up ? 'var(--up)' : 'var(--down)';
            const x   = xOf(i);
            return (
              <g key={`b${floorStart + i}`}>
                <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={col} strokeWidth="1.5"/>
                <line x1={x - bodyW / 2} x2={x} y1={yOf(c.o)} y2={yOf(c.o)} stroke={col} strokeWidth="1.5"/>
                <line x1={x} x2={x + bodyW / 2} y1={yOf(c.c)} y2={yOf(c.c)} stroke={col} strokeWidth="1.5"/>
              </g>
            );
          })}

          {/* MA */}
          {chartType !== 'area' && (() => {
            const pts = Array.from({ length: effectiveCount }, (_, i) => {
              const idx = floorStart + i;
              if (idx < 0 || idx >= allCandles.length) return null;
              return `${xOf(i)},${yOf(maAll[idx])}`;
            }).filter(Boolean).join(' ');
            return pts ? (
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.35" strokeLinejoin="round" opacity="0.78"/>
            ) : null;
          })()}

          {/* Volume */}
          {Array.from({ length: effectiveCount }, (_, i) => {
            const c = candleAt(i);
            if (!c) return null;
            const col = c.c >= c.o ? 'var(--up)' : 'var(--down)';
            const y   = yVol(c.v);
            return (
              <rect key={`v${floorStart + i}`} x={xOf(i) - bodyW / 2} y={y}
                    width={bodyW} height={volumeTop + volH - y} fill={col} opacity="0.22" rx={Math.min(1.5, bodyW / 3)}/>
            );
          })}

          <line x1={padL} x2={padL + plotW} y1={lastY} y2={lastY}
                stroke={lastUp ? 'var(--up)' : 'var(--down)'} strokeWidth="1" strokeDasharray="4 5" opacity="0.45"/>

          {/* X-axis labels */}
          {xLabels.map((l, i) => (
            <text key={`xt${i}`} x={l.x} y={h - 10}
                  fontFamily="var(--mono)" fontSize="10" fill="var(--fg-3)" textAnchor="middle">
              {l.label}
            </text>
          ))}

          {/* Avg price line */}
          {avgPrice && avgPrice > yMin && avgPrice < yMax && (() => {
            const y = yOf(avgPrice);
            const profit = coin.price >= avgPrice;
            const col = profit ? 'var(--up)' : 'var(--down)';
            return (
              <g pointerEvents="none">
                <line x1={padL} x2={padL + plotW} y1={y} y2={y}
                      stroke={col} strokeWidth="1" strokeDasharray="4 3" opacity="0.9"/>
                <rect x={padL + 4} y={y - 9} width={52} height={14} rx="2"
                      fill={col} opacity="0.15"/>
                <text x={padL + 8} y={y + 2} fontFamily="var(--mono)" fontSize="9"
                      fill={col} opacity="0.95">
                  avg {fmtUSD(avgPrice, dec)}
                </text>
              </g>
            );
          })()}

          {/* Crosshair */}
          {hover && !isDragging && (() => {
            const c = candleAt(hover.idx);
            return (
              <g pointerEvents="none">
                <line x1={xOf(hover.idx)} x2={xOf(hover.idx)} y1={padT} y2={padT + plotH}
                      stroke="var(--fg-2)" strokeDasharray="3 4" opacity="0.5"/>
                <line x1={padL} x2={padL + plotW} y1={hover.mouseY} y2={hover.mouseY}
                      stroke="var(--fg-2)" strokeDasharray="3 4" opacity="0.5"/>
                {c && (
                  <circle cx={xOf(hover.idx)} cy={yOf(c.c)} r="3.2"
                          fill="var(--accent)" stroke="var(--bg-0)" strokeWidth="1.8"/>
                )}
              </g>
            );
          })()}
        </svg>

        {/* OHLC tooltip */}
        {hover && !isDragging && candleAt(hover.idx) && (() => {
          const c  = candleAt(hover.idx)!;
          const up = c.c >= c.o;
          const chg = ((c.c - c.o) / c.o) * 100;
          return (
            <div className="ch-tooltip" style={tooltipStyle}>
              <div className="row"><span className="k">{formatLabel(hover.idx)}</span></div>
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
      <div className="ch-price-axis" ref={priceAxisRef} style={{ cursor: 'ns-resize' }}>
        {ticks.map((t, i) => (
          <div key={i} className="tick" style={{ top: t.y }}>{fmtUSD(t.p, dec)}</div>
        ))}
        {avgPrice && avgPrice > yMin && avgPrice < yMax && (
          <div className="ch-yaxis-label" style={{
            display: 'block',
            top: yOf(avgPrice),
            background: coin.price >= avgPrice ? 'var(--up)' : 'var(--down)',
            color: '#fff',
            opacity: 0.85,
          }}>
            {fmtUSD(avgPrice, dec)}
          </div>
        )}
        <div className={'ch-last-price ' + (lastUp ? '' : 'down')} style={{ top: yOf(lastCandle.c) }}>
          {fmtUSD(lastCandle.c, dec)}
        </div>
        {hover && !isDragging && (
          <div className="ch-yaxis-label" style={{ display: 'block', top: hover.mouseY, background: 'var(--bg-3)' }}>
            {fmtUSD(hover.price, dec)}
          </div>
        )}
      </div>
    </div>
  );
}
