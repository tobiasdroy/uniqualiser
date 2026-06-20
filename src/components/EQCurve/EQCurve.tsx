import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import {
  buildCombinedPath,
  buildBandPath,
  freqToX,
  dBToY,
  xToFreq,
  yToDb,
  GRID_FREQUENCIES,
  GRID_DB,
  formatFrequency,
} from '../../audio/frequencyMath';
import type { EQBand } from '../../types';
import styles from './EQCurve.module.css';

const SVG_HEIGHT = 280;

interface DragState {
  id: string;
  mode: 'freq-gain' | 'q-left' | 'q-right';
  bandFreq: number;
}

// Edge frequencies for a Peak band's bandwidth visualisation.
// f_low = f0 * 2^(-1/(2Q)),  f_high = f0 * 2^(1/(2Q))
function bwEdges(freq: number, q: number): [number, number] {
  const half = 1 / (2 * q);
  return [freq * Math.pow(2, -half), freq * Math.pow(2, half)];
}

export function EQCurve() {
  const { bands, updateBand, engineRef, isEngineReady, eqBypassed, hoveredBandIndex, setHoveredBandIndex } = useAppContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [combinedPath, setCombinedPath] = useState('');
  const [bandPaths, setBandPaths] = useState<string[]>([]);
  const [focusedBandIndex, setFocusedBandIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const filterNodes = engineRef.current?.getFilterNodes() ?? [];
    if (filterNodes.length === 0) {
      setCombinedPath('');
      setBandPaths([]);
      return;
    }
    setCombinedPath(buildCombinedPath(filterNodes, width, SVG_HEIGHT));
    setBandPaths(filterNodes.map((n) => buildBandPath(n, width, SVG_HEIGHT)));
  }, [bands, width, engineRef, isEngineReady]);

  // ── Freq/gain drag ───────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, band: EQBand) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: band.id, mode: 'freq-gain', bandFreq: band.frequency };
  }, []);

  // ── Q-handle drag ────────────────────────────────────────────────────────────

  const onQHandleDown = useCallback((e: React.PointerEvent<SVGCircleElement>, band: EQBand, side: 'left' | 'right') => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: band.id, mode: side === 'left' ? 'q-left' : 'q-right', bandFreq: band.frequency };
  }, []);

  // ── Unified pointer-move (both drag modes bubble up to SVG) ─────────────────

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();

      if (drag.mode === 'freq-gain') {
        const newFreq = Math.max(20, Math.min(20000, xToFreq(e.clientX - rect.left, width)));
        const newGain = Math.max(-18, Math.min(18, yToDb(e.clientY - rect.top, SVG_HEIGHT)));
        updateBand(drag.id, { frequency: Math.round(newFreq), gain: parseFloat(newGain.toFixed(1)) });
      } else {
        // Q drag: derive Q from how far the dragged edge is from the centre frequency.
        // Q = 1 / (2 * log2(f_edge / f0))  for the right edge (or f0/f_edge for left).
        const f_drag = xToFreq(e.clientX - rect.left, width);
        const f0 = drag.bandFreq;
        const ratio = drag.mode === 'q-left' ? f0 / f_drag : f_drag / f0;
        if (ratio <= 1) return; // dragged past centre — ignore
        const newQ = Math.max(0.1, Math.min(10, 1 / (2 * Math.log2(ratio))));
        updateBand(drag.id, { q: parseFloat(newQ.toFixed(2)) });
      }
    },
    [width, updateBand],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Keyboard navigation on main handles ─────────────────────────────────────

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGCircleElement>, band: EQBand) => {
      const gainStep = e.shiftKey ? 2 : 0.5;
      const freqMultiplier = e.shiftKey ? 1.2 : 1.05;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          updateBand(band.id, { frequency: Math.max(20, Math.round(band.frequency / freqMultiplier)) });
          break;
        case 'ArrowRight':
          e.preventDefault();
          updateBand(band.id, { frequency: Math.min(20000, Math.round(band.frequency * freqMultiplier)) });
          break;
        case 'ArrowUp':
          e.preventDefault();
          updateBand(band.id, { gain: Math.min(18, parseFloat((band.gain + gainStep).toFixed(1))) });
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateBand(band.id, { gain: Math.max(-18, parseFloat((band.gain - gainStep).toFixed(1))) });
          break;
      }
    },
    [updateBand],
  );

  return (
    <div className={`${styles.container} ${eqBypassed ? styles.bypassed : ''}`}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${width} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="EQ frequency response curve"
      >
        {/* Grid */}
        <g className={styles.grid} aria-hidden="true">
          {GRID_FREQUENCIES.map((freq, i) => {
            const x = freqToX(freq, width);
            const anchor =
              i === 0 ? 'start' : i === GRID_FREQUENCIES.length - 1 ? 'end' : 'middle';
            return (
              <g key={freq}>
                <line x1={x} y1={0} x2={x} y2={SVG_HEIGHT} />
                <text x={x} y={SVG_HEIGHT - 6} textAnchor={anchor}>
                  {formatFrequency(freq)}
                </text>
              </g>
            );
          })}
          {GRID_DB.map((db) => {
            const y = dBToY(db, SVG_HEIGHT);
            return (
              <g key={db}>
                <line
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  className={db === 0 ? styles.zeroLine : undefined}
                />
                {Math.abs(db) < 18 && (
                  <text x={4} y={y - 3} className={styles.dbLabel}>
                    {db > 0 ? `+${db}` : db}dB
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Per-band curves (dimmed) */}
        {bandPaths.map((d, i) => (
          <path key={i} d={d} className={styles.bandCurve} aria-hidden="true" />
        ))}

        {/* Combined curve */}
        {combinedPath && (
          <>
            <path d={combinedPath} className={styles.curveGlow} aria-hidden="true" />
            <path d={combinedPath} className={styles.curve} aria-hidden="true" />
          </>
        )}

        {/* Per-band handles (and bandwidth overlay on hover) */}
        {bands.map((band, index) => {
          const x = freqToX(band.frequency, width);
          const y = dBToY(band.gain, SVG_HEIGHT);
          const isHovered = hoveredBandIndex === index;
          const showBW = isHovered && band.type === 'PK';
          const [fLow, fHigh] = bwEdges(band.frequency, band.q);
          const xLow = freqToX(Math.max(20, fLow), width);
          const xHigh = freqToX(Math.min(20000, fHigh), width);
          const qMidY = SVG_HEIGHT / 2;

          const handleLabel = `Band ${index + 1}: ${formatFrequency(band.frequency)} Hz, ${band.gain > 0 ? '+' : ''}${band.gain} dB. Arrow keys adjust frequency and gain. Hold Shift for larger steps.`;

          return (
            <g
              key={band.id}
              onMouseEnter={() => setHoveredBandIndex(index)}
              onMouseLeave={() => setHoveredBandIndex(null)}
            >
              {showBW && (
                <>
                  {/* Shaded bandwidth region */}
                  <rect
                    x={xLow}
                    y={0}
                    width={Math.max(0, xHigh - xLow)}
                    height={SVG_HEIGHT}
                    className={styles.bwRegion}
                    aria-hidden="true"
                  />

                  {/* Left Q edge */}
                  <line x1={xLow} y1={0} x2={xLow} y2={SVG_HEIGHT} className={styles.qLine} aria-hidden="true" />
                  <circle
                    cx={xLow}
                    cy={qMidY}
                    r={8}
                    className={styles.qHandleHit}
                    onPointerDown={(e) => onQHandleDown(e, band, 'left')}
                    aria-label={`Band ${index + 1} Q — drag left edge to widen or narrow`}
                  />
                  <circle cx={xLow} cy={qMidY} r={3.5} className={styles.qHandle} aria-hidden="true" />

                  {/* Right Q edge */}
                  <line x1={xHigh} y1={0} x2={xHigh} y2={SVG_HEIGHT} className={styles.qLine} aria-hidden="true" />
                  <circle
                    cx={xHigh}
                    cy={qMidY}
                    r={8}
                    className={styles.qHandleHit}
                    onPointerDown={(e) => onQHandleDown(e, band, 'right')}
                    aria-label={`Band ${index + 1} Q — drag right edge to widen or narrow`}
                  />
                  <circle cx={xHigh} cy={qMidY} r={3.5} className={styles.qHandle} aria-hidden="true" />
                </>
              )}

              {/* SVG focus ring — moves with the handle, no CSS outline artifacts */}
              {focusedBandIndex === index && (
                <circle cx={x} cy={y} r={11} className={styles.focusRing} aria-hidden="true" />
              )}

              {/* Main freq/gain handle (on top so it takes precedence at the centre) */}
              <circle
                cx={x}
                cy={y}
                r={16}
                className={`${styles.handleHit} ${isHovered ? styles.handleHitHovered : ''}`}
                onPointerDown={(e) => onPointerDown(e, band)}
                onKeyDown={(e) => onHandleKeyDown(e, band)}
                onFocus={() => setFocusedBandIndex(index)}
                onBlur={() => setFocusedBandIndex(null)}
                tabIndex={0}
                role="slider"
                aria-label={handleLabel}
                aria-valuenow={band.gain}
                aria-valuemin={-18}
                aria-valuemax={18}
                aria-valuetext={`${band.gain > 0 ? '+' : ''}${band.gain} dB at ${formatFrequency(band.frequency)} Hz`}
              />
              <circle cx={x} cy={y} r={5} className={`${styles.handle} ${isHovered ? styles.handleHovered : ''}`} aria-hidden="true" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
