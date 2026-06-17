import { useState, useCallback, useRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Waves } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useSweep } from '../../hooks/useSweep';
import styles from './OscillatorControl.module.css';

const LOG_MIN = Math.log10(20);
const LOG_MAX = Math.log10(20000);
const SWEEP_DURATIONS = [10, 30, 60] as const;

function sliderToFreq(value: number): number {
  return Math.pow(10, LOG_MIN + (value / 1000) * (LOG_MAX - LOG_MIN));
}

function freqToSlider(freq: number): number {
  return ((Math.log10(freq) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000;
}

function freqToPercent(freq: number): number {
  return ((Math.log10(freq) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
}

const TICKS = [
  { freq: 20, label: '20', anchor: 'left' },
  { freq: 50, label: '50', anchor: 'center' },
  { freq: 100, label: '100', anchor: 'center' },
  { freq: 200, label: '200', anchor: 'center' },
  { freq: 500, label: '500', anchor: 'center' },
  { freq: 1000, label: '1k', anchor: 'center' },
  { freq: 2000, label: '2k', anchor: 'center' },
  { freq: 5000, label: '5k', anchor: 'center' },
  { freq: 10000, label: '10k', anchor: 'center' },
  { freq: 20000, label: '20k', anchor: 'right' },
] as const;

export function OscillatorControl() {
  const { engineRef, initEngine, isEngineReady } = useAppContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(1000);
  const [sweepDuration, setSweepDuration] = useState<number>(30);
  const { isSweeping, progress, startSweep, stopSweep } = useSweep(engineRef);

  const handleSliderChange = useCallback(
    ([v]: number[]) => {
      const freq = sliderToFreq(v);
      setFrequency(freq);
      if (isPlaying && engineRef.current) {
        engineRef.current.setOscillatorFrequency(freq);
      }
    },
    [isPlaying, engineRef],
  );

  const handlePlayStop = useCallback(async () => {
    if (!isEngineReady) await initEngine();
    const engine = engineRef.current!;
    if (isPlaying) {
      if (isSweeping) stopSweep();
      engine.stopOscillator();
      setIsPlaying(false);
    } else {
      await engine.startOscillator(frequency);
      setIsPlaying(true);
    }
  }, [isEngineReady, initEngine, engineRef, isPlaying, isSweeping, stopSweep, frequency]);

  const handleSweep = useCallback(async () => {
    if (!isEngineReady) await initEngine();
    const engine = engineRef.current!;
    if (isSweeping) {
      stopSweep();
      return;
    }
    if (!isPlaying) {
      await engine.startOscillator(20);
      setIsPlaying(true);
    }
    startSweep({ startFreq: 20, endFreq: 20000, duration: sweepDuration });
  }, [isEngineReady, initEngine, engineRef, isSweeping, isPlaying, startSweep, stopSweep, sweepDuration]);

  const displayFreq = isSweeping
    ? Math.pow(10, LOG_MIN + progress * (LOG_MAX - LOG_MIN))
    : frequency;

  const freqLabel = `${Math.round(displayFreq).toLocaleString()} Hz`;

  // Editable frequency display
  const [editingFreq, setEditingFreq] = useState<string | null>(null);
  const freqInputRef = useRef<HTMLInputElement>(null);

  const commitFreq = useCallback((raw: string) => {
    const parsed = parseFloat(raw.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      const clamped = Math.round(Math.max(20, Math.min(20000, parsed)));
      setFrequency(clamped);
      if (isPlaying && engineRef.current) {
        engineRef.current.setOscillatorFrequency(clamped);
      }
    }
    setEditingFreq(null);
  }, [isPlaying, engineRef]);

  return (
    <section className={styles.container} aria-label="Sine oscillator">
      <div className={styles.header}>
        <span className={styles.title}>Oscillator</span>
        <input
          ref={freqInputRef}
          className={styles.freqDisplay}
          type="text"
          inputMode="numeric"
          value={editingFreq !== null ? editingFreq : freqLabel}
          readOnly={isSweeping}
          aria-label="Oscillator frequency — click to edit"
          aria-live="polite"
          onChange={(e) => setEditingFreq(e.target.value)}
          onFocus={() => {
            if (!isSweeping) setEditingFreq(String(Math.round(displayFreq)));
          }}
          onBlur={(e) => {
            if (editingFreq !== null) commitFreq(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitFreq((e.target as HTMLInputElement).value); freqInputRef.current?.blur(); }
            if (e.key === 'Escape') { setEditingFreq(null); freqInputRef.current?.blur(); }
          }}
        />
      </div>

      <div className={styles.sliderSection}>
        <SliderPrimitive.Root
          className={styles.sliderRoot}
          min={0}
          max={1000}
          step={1}
          value={[isSweeping ? freqToSlider(displayFreq) : freqToSlider(frequency)]}
          onValueChange={handleSliderChange}
          disabled={isSweeping}
        >
          <SliderPrimitive.Track className={styles.sliderTrack}>
            <SliderPrimitive.Range className={styles.sliderRange} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={styles.sliderThumb}
            aria-label="Oscillator frequency"
            aria-valuemin={20}
            aria-valuemax={20000}
            aria-valuenow={Math.round(displayFreq)}
            aria-valuetext={freqLabel}
          />
        </SliderPrimitive.Root>

        <div className={styles.tickMarks} aria-hidden="true">
          {TICKS.map(({ freq, label, anchor }) => (
            <span
              key={freq}
              className={styles.tick}
              data-anchor={anchor}
              style={{ left: `${freqToPercent(freq)}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isSweeping && (
          <motion.div
            key="sweep-progress"
            className={styles.progressWrap}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="progressbar"
            aria-label="Sweep progress"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.controls}>
        <button
          className={`${styles.playBtn} ${isPlaying ? styles.active : ''}`}
          onClick={handlePlayStop}
          aria-label={isPlaying ? 'Stop oscillator' : 'Play oscillator'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? <Square size={13} strokeWidth={2.5} /> : <Play size={13} strokeWidth={2.5} />}
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <div className={styles.sweepSection}>
          <div className={styles.durationPicker} role="group" aria-label="Sweep duration">
            {SWEEP_DURATIONS.map((d) => (
              <button
                key={d}
                className={`${styles.durationBtn} ${sweepDuration === d ? styles.durationActive : ''}`}
                onClick={() => setSweepDuration(d)}
                disabled={isSweeping}
                aria-label={`Set sweep duration to ${d} seconds`}
                aria-pressed={sweepDuration === d}
              >
                {d}s
              </button>
            ))}
          </div>
          <button
            className={`${styles.sweepBtn} ${isSweeping ? styles.active : ''}`}
            onClick={handleSweep}
            aria-label={isSweeping ? 'Stop frequency sweep' : `Start auto sweep (${sweepDuration} seconds)`}
            aria-pressed={isSweeping}
          >
            <Waves size={14} strokeWidth={2} />
            {isSweeping ? 'Stop Sweep' : 'Auto Sweep'}
          </button>
        </div>
      </div>
    </section>
  );
}
