import { useState, useEffect, useRef, useCallback } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Plus, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { computeAverageGainDb } from '../../audio/frequencyMath';
import type { EQBand, FilterType } from '../../types';
import styles from './EQBandControl.module.css';

// Exact Q ↔ bandwidth conversion (bandwidth in octaves)
// BW = 2/ln(2) · arcsinh(1/(2Q))   ←→   Q = 1/(2·sinh(BW·ln(2)/2))
function qToBw(q: number): number {
  return parseFloat(((2 / Math.LN2) * Math.asinh(1 / (2 * q))).toFixed(2));
}
function bwToQ(bw: number): number {
  const q = 1 / (2 * Math.sinh((bw * Math.LN2) / 2));
  return parseFloat(Math.max(0.1, Math.min(10, q)).toFixed(3));
}
const BW_MIN = 0.14; // ≈ Q 10
const BW_MAX = 6.7;  // ≈ Q 0.1

const FILTER_LABELS: Record<FilterType, string> = { PK: 'Peak', LSC: 'Lo Shelf', HSC: 'Hi Shelf' };
const FILTER_TYPES: FilterType[] = ['PK', 'LSC', 'HSC'];

// ── Knob ─────────────────────────────────────────────────────────────────────

const K_SIZE = 32;
const K_CX = K_SIZE / 2;
const K_CY = K_SIZE / 2;
const K_R = 11;
const K_START = 135;  // SVG degrees: 7:30 clock position
const K_SWEEP = 270;  // degrees of total travel

function polarXY(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [K_CX + r * Math.cos(rad), K_CY + r * Math.sin(rad)];
}

function arcD(startDeg: number, sweepDeg: number): string {
  if (Math.abs(sweepDeg) < 0.5) return '';
  const [x1, y1] = polarXY(K_R, startDeg);
  const [x2, y2] = polarXY(K_R, startDeg + sweepDeg);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${K_R} ${K_R} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  logScale?: boolean;
}

function Knob({ value, min, max, step, onChange, label, logScale = false }: KnobProps) {
  const drag = useRef({ active: false, startY: 0, startT: 0 });

  const toT = (v: number) =>
    logScale ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);

  const fromT = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    const raw = logScale ? min * Math.pow(max / min, c) : min + c * (max - min);
    const dp = Math.max(0, Math.round(-Math.log10(step)));
    return Math.max(min, Math.min(max, parseFloat(raw.toFixed(dp))));
  };

  const t = Math.max(0, Math.min(1, toT(value)));
  const valSweep = t * K_SWEEP;
  const bgD = arcD(K_START, K_SWEEP);
  const valD = arcD(K_START, valSweep);
  const [indX, indY] = polarXY(K_R - 3.5, K_START + valSweep);

  return (
    <svg
      width={K_SIZE}
      height={K_SIZE}
      className={styles.knob}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { active: true, startY: e.clientY, startT: toT(value) };
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        onChange(fromT(drag.current.startT + (drag.current.startY - e.clientY) / 200));
      }}
      onPointerUp={(e) => {
        drag.current.active = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        const mult = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, value + step * mult)));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, value - step * mult)));
        }
      }}
    >
      <path d={bgD} fill="none" stroke="var(--bg-primary)" strokeWidth={2.5} strokeLinecap="round" />
      {valSweep > 0.5 && (
        <path d={valD} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />
      )}
      <circle cx={indX.toFixed(2)} cy={indY.toFixed(2)} r={2} fill="var(--accent)" />
    </svg>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className={styles.tooltip} sideOffset={6}>
          {label}
          <TooltipPrimitive.Arrow className={styles.tooltipArrow} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ── NumberInput ───────────────────────────────────────────────────────────────

// Holds local string state while the user is typing so intermediate values
// (empty field, partial numbers, leading minus) don't snap back. Commits and
// clamps on blur; syncs from external prop changes only when not focused.
function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  className?: string;
  'aria-label': string;
}) {
  const [local, setLocal] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(String(value));
  }, [value]);

  return (
    <input
      type="number"
      className={className}
      value={local}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        const v = parseFloat(raw);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      onBlur={() => {
        focused.current = false;
        const v = parseFloat(local);
        const clamped = isNaN(v) ? value : Math.max(min, Math.min(max, v));
        setLocal(String(clamped));
        onChange(clamped);
      }}
    />
  );
}

// ── BandRow ───────────────────────────────────────────────────────────────────

function BandRow({ band, index, showRemove, bwMode }: { band: EQBand; index: number; showRemove: boolean; bwMode: boolean }) {
  const { updateBand, removeBand, hoveredBandIndex, setHoveredBandIndex } = useAppContext();
  const n = index + 1;
  const showQ = band.type === 'PK';
  const isHighlighted = hoveredBandIndex === index;

  const qKnobValue = bwMode ? qToBw(band.q) : band.q;
  const qKnobMin   = bwMode ? BW_MIN : 0.1;
  const qKnobMax   = bwMode ? BW_MAX : 10;
  const qKnobLabel = bwMode ? `Band ${n} bandwidth in octaves` : `Band ${n} Q factor (bandwidth)`;
  const handleQChange = (v: number) => updateBand(band.id, { q: bwMode ? bwToQ(v) : v });

  return (
    <div
      className={`${styles.row} ${!band.enabled ? styles.disabled : ''} ${isHighlighted ? styles.highlighted : ''}`}
      role="group"
      aria-label={`EQ band ${n}`}
      onMouseEnter={() => setHoveredBandIndex(index)}
      onMouseLeave={() => setHoveredBandIndex(null)}
    >
      <button
        className={`${styles.enableToggle} ${band.enabled ? styles.enabled : ''}`}
        onClick={() => updateBand(band.id, { enabled: !band.enabled })}
        aria-label={`Band ${n}: ${band.enabled ? 'enabled, click to disable' : 'disabled, click to enable'}`}
        aria-pressed={band.enabled}
      >
        {n}
      </button>

      <div className={styles.typeSelect} role="group" aria-label={`Band ${n} filter type`}>
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            className={`${styles.typeBtn} ${band.type === t ? styles.typeActive : ''}`}
            onClick={() => updateBand(band.id, { type: t })}
            aria-label={`Set band ${n} to ${FILTER_LABELS[t]}`}
            aria-pressed={band.type === t}
          >
            {FILTER_LABELS[t]}
          </button>
        ))}
      </div>

      <div className={styles.paramGroup}>
        <Knob
          value={band.frequency}
          min={20}
          max={20000}
          step={1}
          logScale
          onChange={(v) => updateBand(band.id, { frequency: v })}
          label={`Band ${n} frequency`}
        />
        <label className={styles.paramLabel}>
          <span className={styles.paramName}>Freq</span>
          <NumberInput
            value={band.frequency}
            min={20}
            max={20000}
            step={1}
            className={styles.paramInput}
            aria-label={`Band ${n} frequency in Hz`}
            onChange={(v) => updateBand(band.id, { frequency: v })}
          />
          <span className={styles.paramUnit} aria-hidden="true">Hz</span>
        </label>
      </div>

      <div className={styles.paramGroup}>
        <Knob
          value={band.gain}
          min={-18}
          max={18}
          step={0.1}
          onChange={(v) => updateBand(band.id, { gain: v })}
          label={`Band ${n} gain`}
        />
        <label className={styles.paramLabel}>
          <span className={styles.paramName}>Gain</span>
          <NumberInput
            value={band.gain}
            min={-18}
            max={18}
            step={0.1}
            className={styles.paramInput}
            aria-label={`Band ${n} gain in decibels`}
            onChange={(v) => updateBand(band.id, { gain: v })}
          />
          <span className={styles.paramUnit} aria-hidden="true">dB</span>
        </label>
      </div>

      {showQ ? (
        <div className={styles.paramGroup}>
          <Knob
            value={qKnobValue}
            min={qKnobMin}
            max={qKnobMax}
            step={0.01}
            logScale
            onChange={handleQChange}
            label={bwMode ? `Band ${n} bandwidth` : `Band ${n} Q`}
          />
          <label className={styles.paramLabel}>
            <span className={styles.paramName}>{bwMode ? 'BW' : 'Q'}</span>
            <NumberInput
              value={qKnobValue}
              min={qKnobMin}
              max={qKnobMax}
              step={0.01}
              className={styles.paramInput}
              aria-label={qKnobLabel}
              onChange={handleQChange}
            />
            {bwMode && <span className={styles.paramUnit} aria-hidden="true">oct</span>}
          </label>
        </div>
      ) : (
        <div aria-hidden="true" />
      )}

      {showRemove ? (
        <button
          className={styles.removeBtn}
          onClick={() => removeBand(band.id)}
          aria-label={`Remove band ${n}`}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      ) : (
        <div className={styles.removePlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

// ── EQBandControl ─────────────────────────────────────────────────────────────

export function EQBandControl() {
  const { bands, addBand, resetGains, eqBypassed, setEQBypassed, preampGain, setPreampGain, engineRef, isEngineReady } = useAppContext();
  const [resetPending, setResetPending] = useState(false);
  const [levelMatch, setLevelMatch] = useState(true);
  const [bwMode, setBwMode] = useState(false);

  const handleResetConfirm = useCallback(() => {
    resetGains();
    setResetPending(false);
  }, [resetGains]);

  // Recompute bypass trim whenever bands or levelMatch changes.
  // Trim attenuates the flat bypass signal to match the EQ'd level —
  // the EQ path itself is never modified.
  useEffect(() => {
    if (!isEngineReady || !engineRef.current) return;
    if (!levelMatch) {
      engineRef.current.setBypassTrim(1);
      return;
    }
    const filterNodes = engineRef.current.getFilterNodes();
    const avgDb = computeAverageGainDb(filterNodes);
    engineRef.current.setBypassTrim(Math.pow(10, avgDb / 20));
  }, [bands, levelMatch, isEngineReady, engineRef]);

  return (
    <section className={`${styles.container} ${eqBypassed ? styles.bypassed : ''}`} aria-label="Parametric EQ bands">
      <div className={styles.header}>
        <span className={styles.title} id="eq-bands-heading">EQ Bands</span>
        <div className={styles.headerActions}>
          {resetPending ? (
            <>
              <span className={styles.confirmText}>Reset all gains?</span>
              <button className={styles.confirmBtn} onClick={handleResetConfirm}>
                Confirm
              </button>
              <button className={styles.cancelBtn} onClick={() => setResetPending(false)}>
                Cancel
              </button>
            </>
          ) : (
            <Tip label="Zero all band gains">
              <button
                className={styles.resetBtn}
                onClick={() => setResetPending(true)}
                aria-label="Reset all band gains to 0 dB"
              >
                <RotateCcw size={12} strokeWidth={2.5} />
                Reset
              </button>
            </Tip>
          )}
          <Tip label="Match loudness between EQ and bypass paths">
            <button
              className={`${styles.levelBtn} ${levelMatch ? styles.levelActive : ''}`}
              onClick={() => setLevelMatch((v) => !v)}
              aria-pressed={levelMatch}
              aria-label={levelMatch ? 'Level match on' : 'Level match off'}
            >
              Level Match
            </button>
          </Tip>
          <Tip label={bwMode ? 'Showing bandwidth in octaves — click for Q factor' : 'Showing Q factor — click for bandwidth in octaves'}>
            <button
              className={`${styles.levelBtn} ${bwMode ? styles.levelActive : ''}`}
              onClick={() => setBwMode((v) => !v)}
              aria-pressed={bwMode}
              aria-label={bwMode ? 'BW mode: bandwidth in octaves — click for Q' : 'Q mode: Q factor — click for bandwidth in octaves'}
            >
              {bwMode ? 'BW' : 'Q'}
            </button>
          </Tip>
          <Tip label={eqBypassed ? 'Restore EQ' : 'Bypass EQ to compare flat response'}>
            <button
              className={`${styles.abBtn} ${eqBypassed ? styles.abActive : ''}`}
              onClick={() => setEQBypassed(!eqBypassed)}
              aria-pressed={eqBypassed}
              aria-label={eqBypassed ? 'EQ bypassed — click to restore' : 'Bypass EQ — click to compare flat response'}
            >
              {eqBypassed ? 'Bypassed' : 'Bypass'}
            </button>
          </Tip>
        </div>
      </div>

      <div className={styles.preampRow}>
        <label className={styles.preampLabel}>
          <span className={styles.preampName}>Preamp</span>
          <NumberInput
            value={preampGain}
            min={-20}
            max={6}
            step={0.5}
            className={styles.preampInput}
            aria-label="Preamp gain in decibels"
            onChange={(v) => setPreampGain(v)}
          />
          <span className={styles.preampUnit}>dB</span>
        </label>
      </div>

      <div className={styles.bands} role="list" aria-labelledby="eq-bands-heading">
        <AnimatePresence initial={false}>
          {bands.map((band, i) => (
            <motion.div
              key={band.id}
              role="listitem"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <BandRow band={band} index={i} showRemove={bands.length > 1} bwMode={bwMode} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className={styles.bottomBar}>
        <p className={styles.hint} aria-live="polite">
          {bands.length}/10 bands · Drag handles on the curve, or use arrow keys when a handle is focused
        </p>
        <Tip label={bands.length >= 10 ? 'Maximum 10 bands' : 'Add a new EQ band'}>
          <button
            className={styles.addBtn}
            onClick={addBand}
            disabled={bands.length >= 10}
            aria-label={`Add EQ band (${bands.length} of 10 in use)`}
          >
            <Plus size={12} strokeWidth={2.5} />
            Add Band
          </button>
        </Tip>
      </div>
    </section>
  );
}
