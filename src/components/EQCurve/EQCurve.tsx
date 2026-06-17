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
}

export function EQCurve() {
  const { bands, updateBand, engineRef } = useAppContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [combinedPath, setCombinedPath] = useState('');
  const [bandPaths, setBandPaths] = useState<string[]>([]);
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
  }, [bands, width, engineRef]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, band: EQBand) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: band.id };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const newFreq = Math.max(20, Math.min(20000, xToFreq(e.clientX - rect.left, width)));
      const newGain = Math.max(-24, Math.min(24, yToDb(e.clientY - rect.top, SVG_HEIGHT)));
      updateBand(drag.id, { frequency: Math.round(newFreq), gain: parseFloat(newGain.toFixed(1)) });
    },
    [width, updateBand],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Keyboard navigation on handles: arrows adjust freq/gain; Shift = larger step
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
          updateBand(band.id, { gain: Math.min(24, parseFloat((band.gain + gainStep).toFixed(1))) });
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateBand(band.id, { gain: Math.max(-24, parseFloat((band.gain - gainStep).toFixed(1))) });
          break;
      }
    },
    [updateBand],
  );

  return (
    <div className={styles.container}>
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
                <text x={4} y={y - 3} className={styles.dbLabel}>
                  {db > 0 ? `+${db}` : db}dB
                </text>
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

        {/* Draggable + keyboard-navigable handles */}
        {bands.map((band, index) => {
          const x = freqToX(band.frequency, width);
          const y = dBToY(band.gain, SVG_HEIGHT);
          const label = `Band ${index + 1}: ${formatFrequency(band.frequency)} Hz, ${band.gain > 0 ? '+' : ''}${band.gain} dB. Arrow keys adjust frequency and gain. Hold Shift for larger steps.`;
          return (
            <g key={band.id}>
              <circle
                cx={x}
                cy={y}
                r={16}
                className={styles.handleHit}
                onPointerDown={(e) => onPointerDown(e, band)}
                onKeyDown={(e) => onHandleKeyDown(e, band)}
                tabIndex={0}
                role="slider"
                aria-label={label}
                aria-valuenow={band.gain}
                aria-valuemin={-24}
                aria-valuemax={24}
                aria-valuetext={`${band.gain > 0 ? '+' : ''}${band.gain} dB at ${formatFrequency(band.frequency)} Hz`}
              />
              <circle cx={x} cy={y} r={5} className={styles.handle} aria-hidden="true" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
