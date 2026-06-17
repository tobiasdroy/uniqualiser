import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { computeAverageGainDb } from '../../audio/frequencyMath';
import type { EQBand, FilterType } from '../../types';
import styles from './EQBandControl.module.css';

const FILTER_LABELS: Record<FilterType, string> = { PK: 'Peak', LSC: 'Low Shelf', HSC: 'High Shelf' };
const FILTER_TYPES: FilterType[] = ['PK', 'LSC', 'HSC'];

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

function BandRow({ band, index, showRemove }: { band: EQBand; index: number; showRemove: boolean }) {
  const { updateBand, removeBand } = useAppContext();
  const n = index + 1;

  return (
    <div className={`${styles.row} ${!band.enabled ? styles.disabled : ''}`} role="group" aria-label={`EQ band ${n}`}>
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
            {t}
          </button>
        ))}
      </div>

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

      <label className={styles.paramLabel}>
        <span className={styles.paramName}>Gain</span>
        <NumberInput
          value={band.gain}
          min={-24}
          max={24}
          step={0.1}
          className={styles.paramInput}
          aria-label={`Band ${n} gain in decibels`}
          onChange={(v) => updateBand(band.id, { gain: v })}
        />
        <span className={styles.paramUnit} aria-hidden="true">dB</span>
      </label>

      <label className={styles.paramLabel}>
        <span className={styles.paramName}>Q</span>
        <NumberInput
          value={band.q}
          min={0.1}
          max={10}
          step={0.01}
          className={styles.paramInput}
          aria-label={`Band ${n} Q factor (bandwidth)`}
          onChange={(v) => updateBand(band.id, { q: v })}
        />
      </label>

      {showRemove ? (
        <button
          className={styles.removeBtn}
          onClick={() => removeBand(band.id)}
          aria-label={`Remove band ${n}`}
        >
          ×
        </button>
      ) : (
        <div className={styles.removePlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

export function EQBandControl() {
  const { bands, addBand, resetGains, eqBypassed, setEQBypassed, preampGain, setPreampGain, engineRef, isEngineReady } = useAppContext();
  const [resetPending, setResetPending] = useState(false);
  const [levelMatch, setLevelMatch] = useState(false);

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
    // avgDb is negative for cuts, positive for boosts.
    // Apply the same gain to bypass so it matches the EQ path's average level.
    engineRef.current.setBypassTrim(Math.pow(10, avgDb / 20));
  }, [bands, levelMatch, isEngineReady, engineRef]);

  return (
    <section className={styles.container} aria-label="Parametric EQ bands">
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
            <button
              className={styles.resetBtn}
              onClick={() => setResetPending(true)}
              aria-label="Reset all band gains to 0 dB"
            >
              Reset
            </button>
          )}
          <button
            className={`${styles.levelBtn} ${levelMatch ? styles.levelActive : ''}`}
            onClick={() => setLevelMatch((v) => !v)}
            aria-pressed={levelMatch}
            aria-label={levelMatch ? 'Level match on — EQ path compensated for equal loudness' : 'Level match off — click to compensate EQ gain for equal A/B loudness'}
          >
            Level
          </button>
          <button
            className={`${styles.abBtn} ${eqBypassed ? styles.abActive : ''}`}
            onClick={() => setEQBypassed(!eqBypassed)}
            aria-pressed={eqBypassed}
            aria-label={eqBypassed ? 'A/B: EQ bypassed — click to restore' : 'A/B: EQ active — click to bypass'}
          >
            A/B
          </button>
          <button
            className={styles.addBtn}
            onClick={addBand}
            disabled={bands.length >= 10}
            aria-label={`Add EQ band (${bands.length} of 10 in use)`}
          >
            + Add Band
          </button>
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
        {bands.map((band, i) => (
          <div key={band.id} role="listitem">
            <BandRow band={band} index={i} showRemove={bands.length > 1} />
          </div>
        ))}
      </div>
      <p className={styles.hint} aria-live="polite">
        {bands.length}/10 bands · Drag handles on the curve, or use arrow keys when a handle is focused
      </p>
    </section>
  );
}
