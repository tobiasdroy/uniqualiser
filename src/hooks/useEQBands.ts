import { useReducer, useCallback } from 'react';
import type { RefObject } from 'react';
import type { EQBand, EQProfile, FilterType } from '../types';
import type { AudioEngine } from '../audio/AudioEngine';

interface State {
  bands: EQBand[];
  preampGain: number;
}

type Action =
  | { type: 'ADD_BAND'; band: EQBand }
  | { type: 'REMOVE_BAND'; id: string }
  | { type: 'UPDATE_BAND'; id: string; patch: Partial<EQBand> }
  | { type: 'LOAD_PROFILE'; profile: EQProfile }
  | { type: 'SET_PREAMP'; gain: number }
  | { type: 'RESET_GAINS' };

function defaultBand(overrides?: Partial<EQBand>): EQBand {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    type: 'PK',
    frequency: 1000,
    gain: 0,
    q: 1.0,
    ...overrides,
  };
}

const DEFAULT_BANDS: EQBand[] = [
  defaultBand({ frequency: 100 }),
  defaultBand({ frequency: 400 }),
  defaultBand({ frequency: 1000 }),
  defaultBand({ frequency: 4000 }),
  defaultBand({ frequency: 12000 }),
];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_BAND':
      return { ...state, bands: [...state.bands, action.band] };
    case 'REMOVE_BAND':
      return { ...state, bands: state.bands.filter((b) => b.id !== action.id) };
    case 'UPDATE_BAND':
      return {
        ...state,
        bands: state.bands.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)),
      };
    case 'LOAD_PROFILE':
      return { bands: action.profile.bands, preampGain: action.profile.preampGain };
    case 'SET_PREAMP':
      return { ...state, preampGain: action.gain };
    case 'RESET_GAINS':
      return { ...state, bands: state.bands.map((b) => ({ ...b, gain: 0 })) };
  }
}

export function useEQBands(engineRef: RefObject<AudioEngine | null>) {
  const [state, dispatch] = useReducer(reducer, {
    bands: DEFAULT_BANDS,
    preampGain: 0,
  });

  const addBand = useCallback(() => {
    if (state.bands.length >= 10) return;
    const band = defaultBand();
    engineRef.current?.addBand();
    dispatch({ type: 'ADD_BAND', band });
  }, [engineRef, state.bands.length]);

  const removeBand = useCallback(
    (id: string) => {
      if (state.bands.length <= 1) return;
      const index = state.bands.findIndex((b) => b.id === id);
      if (index === -1) return;
      engineRef.current?.removeBand(index);
      dispatch({ type: 'REMOVE_BAND', id });
    },
    [engineRef, state.bands],
  );

  const updateBand = useCallback(
    (id: string, patch: Partial<EQBand>) => {
      const index = state.bands.findIndex((b) => b.id === id);
      if (index === -1) return;
      const engine = engineRef.current;
      if (engine) {
        if (patch.frequency !== undefined) engine.setBandFrequency(index, patch.frequency);
        if (patch.gain !== undefined) engine.setBandGain(index, patch.gain);
        if (patch.q !== undefined) engine.setBandQ(index, patch.q);
        if (patch.type !== undefined) {
          engine.setBandType(index, patch.type as FilterType);
          // Sync gain/Q after type change so the engine node is consistent
          const current = state.bands[index];
          engine.setBandGain(index, patch.gain ?? current.gain);
          engine.setBandQ(index, patch.q ?? current.q);
        }
        if (patch.enabled !== undefined) {
          const gain = patch.gain ?? state.bands[index].gain;
          engine.setBandEnabled(index, patch.enabled, gain);
        }
      }
      dispatch({ type: 'UPDATE_BAND', id, patch });
    },
    [engineRef, state.bands],
  );

  const loadProfile = useCallback(
    (profile: EQProfile) => {
      const engine = engineRef.current;
      if (engine) {
        // Sync engine band count to profile
        const diff = profile.bands.length - state.bands.length;
        for (let i = 0; i < diff; i++) engine.addBand();
        for (let i = 0; i > diff; i--) engine.removeBand(engine.getFilterNodes().length - 1);
        // Sync each band
        profile.bands.forEach((band, i) => {
          engine.setBandType(i, band.type);
          engine.setBandFrequency(i, band.frequency);
          engine.setBandGain(i, band.gain);
          engine.setBandQ(i, band.q);
          engine.setBandEnabled(i, band.enabled);
        });
        engine.setMasterGain(Math.pow(10, profile.preampGain / 20));
      }
      dispatch({ type: 'LOAD_PROFILE', profile });
    },
    [engineRef, state.bands.length],
  );

  const resetGains = useCallback(() => {
    state.bands.forEach((_, i) => {
      engineRef.current?.setBandGain(i, 0);
    });
    dispatch({ type: 'RESET_GAINS' });
  }, [engineRef, state.bands]);

  const setPreampGain = useCallback(
    (gain: number) => {
      engineRef.current?.setMasterGain(Math.pow(10, gain / 20));
      dispatch({ type: 'SET_PREAMP', gain });
    },
    [engineRef],
  );

  return {
    bands: state.bands,
    preampGain: state.preampGain,
    addBand,
    removeBand,
    updateBand,
    resetGains,
    loadProfile,
    setPreampGain,
  };
}
