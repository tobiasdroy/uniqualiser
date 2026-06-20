import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { RefObject } from 'react';
import type { EQBand, EQProfile } from '../types';
import type { AudioEngine } from '../audio/AudioEngine';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useEQBands } from '../hooks/useEQBands';
import { computePeakGainDb } from '../audio/frequencyMath';

interface AppContextValue {
  engineRef: RefObject<AudioEngine | null>;
  isEngineReady: boolean;
  initEngine: () => Promise<void>;
  panic: () => void;
  bands: EQBand[];
  preampGain: number;
  addBand: () => void;
  removeBand: (id: string) => void;
  updateBand: (id: string, patch: Partial<EQBand>) => void;
  resetGains: () => void;
  loadProfile: (profile: EQProfile) => void;
  setPreampGain: (gain: number) => void;
  eqBypassed: boolean;
  setEQBypassed: (bypassed: boolean) => void;
  hoveredBandIndex: number | null;
  setHoveredBandIndex: (i: number | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, safetyAccepted }: { children: ReactNode; safetyAccepted: boolean }) {
  const { engineRef, isReady, initEngine, panic } = useAudioEngine(safetyAccepted);
  const { bands, preampGain, addBand, removeBand, updateBand, resetGains, loadProfile, setPreampGain } =
    useEQBands(engineRef);
  const [eqBypassed, setEQBypassedState] = useState(false);
  const [hoveredBandIndex, setHoveredBandIndex] = useState<number | null>(null);

  const setEQBypassed = useCallback(
    (bypassed: boolean) => {
      engineRef.current?.setEQBypassed(bypassed);
      setEQBypassedState(bypassed);
    },
    [engineRef],
  );

  // After any band mutation, pull the peak from the live filter nodes and reduce
  // the preamp to compensate, preventing digital clipping from boosts.
  const applyAutoPreamp = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const peakDb = computePeakGainDb(engine.getFilterNodes());
    const compensation = -Math.max(0, peakDb);
    const rounded = Math.round(compensation * 10) / 10;
    setPreampGain(rounded);
  }, [engineRef, setPreampGain]);

  const updateBandAuto = useCallback(
    (id: string, patch: Partial<EQBand>) => { updateBand(id, patch); applyAutoPreamp(); },
    [updateBand, applyAutoPreamp],
  );
  const addBandAuto = useCallback(
    () => { addBand(); applyAutoPreamp(); },
    [addBand, applyAutoPreamp],
  );
  const removeBandAuto = useCallback(
    (id: string) => { removeBand(id); applyAutoPreamp(); },
    [removeBand, applyAutoPreamp],
  );
  const resetGainsAuto = useCallback(
    () => { resetGains(); applyAutoPreamp(); },
    [resetGains, applyAutoPreamp],
  );
  const loadProfileAuto = useCallback(
    (profile: EQProfile) => { loadProfile(profile); applyAutoPreamp(); },
    [loadProfile, applyAutoPreamp],
  );

  return (
    <AppContext.Provider
      value={{
        engineRef,
        isEngineReady: isReady,
        initEngine,
        panic,
        bands,
        preampGain,
        addBand: addBandAuto,
        removeBand: removeBandAuto,
        updateBand: updateBandAuto,
        resetGains: resetGainsAuto,
        loadProfile: loadProfileAuto,
        setPreampGain,
        eqBypassed,
        setEQBypassed,
        hoveredBandIndex,
        setHoveredBandIndex,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
