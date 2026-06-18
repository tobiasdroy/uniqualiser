export type FilterType = 'PK' | 'LSC' | 'HSC';

export interface EQBand {
  id: string;
  enabled: boolean;
  type: FilterType;
  frequency: number;  // Hz, 20–20000
  gain: number;       // dB, -18 to +18
  q: number;          // 0.1 to 10
}

export interface SweepConfig {
  duration: number;   // seconds
  startFreq: number;
  endFreq: number;
}

export interface EQProfile {
  preampGain: number; // dB
  bands: EQBand[];
}
