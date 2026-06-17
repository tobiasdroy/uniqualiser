const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -12;
const MAX_DB = 12;
const CURVE_POINTS = 512;

export const FREQ_ARRAY: Float32Array = (() => {
  const arr = new Float32Array(CURVE_POINTS);
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  for (let i = 0; i < CURVE_POINTS; i++) {
    arr[i] = Math.pow(10, logMin + (i / (CURVE_POINTS - 1)) * (logMax - logMin));
  }
  return arr;
})();

const MAG_BUF = new Float32Array(CURVE_POINTS);
const PHASE_BUF = new Float32Array(CURVE_POINTS);

export function freqToX(freq: number, width: number): number {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  return ((Math.log10(freq) - logMin) / (logMax - logMin)) * width;
}

export function xToFreq(x: number, width: number): number {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  return Math.pow(10, logMin + (x / width) * (logMax - logMin));
}

export function dBToY(db: number, height: number): number {
  return ((MAX_DB - db) / (MAX_DB - MIN_DB)) * height;
}

export function yToDb(y: number, height: number): number {
  return MAX_DB - (y / height) * (MAX_DB - MIN_DB);
}

export function buildCombinedPath(
  filterNodes: BiquadFilterNode[],
  width: number,
  height: number,
): string {
  const combined = new Float32Array(CURVE_POINTS).fill(1.0);
  for (const node of filterNodes) {
    node.getFrequencyResponse(FREQ_ARRAY, MAG_BUF, PHASE_BUF);
    for (let i = 0; i < CURVE_POINTS; i++) {
      combined[i] *= MAG_BUF[i];
    }
  }
  return magnitudesToPath(combined, width, height);
}

export function buildBandPath(
  node: BiquadFilterNode,
  width: number,
  height: number,
): string {
  node.getFrequencyResponse(FREQ_ARRAY, MAG_BUF, PHASE_BUF);
  return magnitudesToPath(MAG_BUF, width, height);
}

function magnitudesToPath(magnitudes: Float32Array, width: number, height: number): string {
  let d = '';
  for (let i = 0; i < CURVE_POINTS; i++) {
    const x = (i / (CURVE_POINTS - 1)) * width;
    const db = 20 * Math.log10(Math.max(magnitudes[i], 1e-10));
    const y = dBToY(Math.max(MIN_DB, Math.min(MAX_DB, db)), height);
    d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
}

export function formatFrequency(freq: number): string {
  if (freq >= 1000) return `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(freq)}`;
}

export const GRID_FREQUENCIES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
export const GRID_DB = [-12, -6, 0, 6, 12];
