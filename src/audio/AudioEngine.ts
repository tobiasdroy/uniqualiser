import type { FilterType, SweepConfig } from '../types';

const FILTER_TYPE_MAP: Record<FilterType, BiquadFilterType> = {
  PK: 'peaking',
  LSC: 'lowshelf',
  HSC: 'highshelf',
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private oscGainNode: GainNode | null = null;
  private fileGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private safetyLimiterNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private bypassTrimNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private currentOscillator: OscillatorNode | null = null;
  private currentFileSource: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private playbackOffset = 0;
  private playbackStartTime = 0;
  private fileIsPlaying = false;
  private onFileEnded: (() => void) | null = null;
  private fileEQEnabled = true;
  private eqBypassed = false;
  private preampLinear = 1.0;
  private oscGainLinear = Math.pow(10, -12 / 20);
  private sweepTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private oscFadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  init(): void {
    if (this.ctx) return;

    this.ctx = new AudioContext();

    this.oscGainNode = this.ctx.createGain();
    this.oscGainNode.gain.value = this.oscGainLinear;
    this.fileGainNode = this.ctx.createGain();
    this.masterGainNode = this.ctx.createGain();
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;

    this.bypassTrimNode = this.ctx.createGain();

    // Hard output ceiling at -1 dBFS before the compressor
    this.safetyLimiterNode = this.ctx.createGain();
    this.safetyLimiterNode.gain.value = 0.89;

    // Brick-wall compressor/limiter — inaudible during normal use,
    // engages only when the signal approaches 0 dBFS
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -1;
    this.compressorNode.knee.value = 0;
    this.compressorNode.ratio.value = 20;
    this.compressorNode.attack.value = 0.001;
    this.compressorNode.release.value = 0.1;

    // Chain: EQ → analyser → masterGain → safetyLimiter → compressor → destination
    this.analyserNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.safetyLimiterNode);
    this.safetyLimiterNode.connect(this.compressorNode);
    this.compressorNode.connect(this.ctx.destination);

    for (let i = 0; i < 5; i++) {
      const node = this.ctx.createBiquadFilter();
      node.type = 'peaking';
      node.frequency.value = this.defaultFrequencyForBand(i);
      node.gain.value = 0;
      node.Q.value = 1.0;
      this.filterNodes.push(node);
    }

    this.rebuildChain();
  }

  async resumeContext(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Immediately silences all audio and stops all sources.
  panic(): void {
    if (!this.ctx || !this.masterGainNode) return;
    this.masterGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.stopOscillator();
    this.stopFile();
  }

  private defaultFrequencyForBand(index: number): number {
    const defaults = [100, 400, 1000, 4000, 12000];
    return defaults[index] ?? 1000;
  }

  private getChainEntry(): AudioNode {
    if (this.filterNodes.length > 0) return this.filterNodes[0];
    return this.analyserNode!;
  }

  rebuildChain(): void {
    if (!this.ctx || !this.oscGainNode || !this.fileGainNode || !this.analyserNode || !this.bypassTrimNode) return;

    this.oscGainNode.disconnect();
    this.fileGainNode.disconnect();
    this.bypassTrimNode.disconnect();
    for (const node of this.filterNodes) {
      node.disconnect();
    }

    if (this.eqBypassed) {
      // Bypass path: sources → bypassTrimNode → analyser
      // bypassTrimNode attenuates the flat signal to match the EQ'd level when Level Match is on
      this.bypassTrimNode.connect(this.analyserNode);
      this.oscGainNode.connect(this.bypassTrimNode);
      this.fileGainNode.connect(this.bypassTrimNode);
      return;
    }

    // EQ path: sources → filters → analyser (EQ chain is unmodified)
    for (let i = 0; i < this.filterNodes.length - 1; i++) {
      this.filterNodes[i].connect(this.filterNodes[i + 1]);
    }
    if (this.filterNodes.length > 0) {
      this.filterNodes[this.filterNodes.length - 1].connect(this.analyserNode);
    }

    const entry = this.getChainEntry();
    this.oscGainNode.connect(entry);

    if (this.fileEQEnabled) {
      this.fileGainNode.connect(entry);
    } else {
      this.fileGainNode.connect(this.analyserNode);
    }
  }

  setEQBypassed(bypassed: boolean): void {
    this.eqBypassed = bypassed;
    this.rebuildChain();
  }

  setBypassTrim(gain: number): void {
    if (this.bypassTrimNode) this.bypassTrimNode.gain.value = gain;
  }

  // ── Oscillator ──────────────────────────────────────────────────────────────

  async startOscillator(freq: number): Promise<void> {
    if (!this.ctx || !this.oscGainNode) return;
    await this.resumeContext();
    // Restore master gain in case panic() was previously called
    this.masterGainNode?.gain.setValueAtTime(this.preampLinear, this.ctx.currentTime);
    this.stopOscillator(); // immediate stop of any previous osc

    // Fade in from silence to avoid click
    const now = this.ctx.currentTime;
    this.oscGainNode.gain.cancelScheduledValues(now);
    this.oscGainNode.gain.setValueAtTime(0, now);
    this.oscGainNode.gain.linearRampToValueAtTime(this.oscGainLinear, now + 0.008);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(this.oscGainNode);
    osc.start();
    this.currentOscillator = osc;
  }

  stopOscillator(): void {
    // Cancel any pending fade-out before doing an immediate stop
    if (this.oscFadeTimeoutId !== null) {
      clearTimeout(this.oscFadeTimeoutId);
      this.oscFadeTimeoutId = null;
    }
    if (this.oscGainNode && this.ctx) {
      this.oscGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.oscGainNode.gain.setValueAtTime(this.oscGainLinear, this.ctx.currentTime);
    }
    if (this.currentOscillator) {
      try { this.currentOscillator.stop(); } catch { /* already stopped */ }
      this.currentOscillator.disconnect();
      this.currentOscillator = null;
    }
  }

  // Fade out over 8 ms before stopping — call this for user-initiated stops.
  stopOscillatorFaded(): void {
    if (!this.ctx || !this.currentOscillator || !this.oscGainNode) {
      this.stopOscillator();
      return;
    }
    const fadeDuration = 0.008;
    const now = this.ctx.currentTime;
    this.oscGainNode.gain.cancelScheduledValues(now);
    this.oscGainNode.gain.setValueAtTime(this.oscGainNode.gain.value, now);
    this.oscGainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);

    const osc = this.currentOscillator;
    this.currentOscillator = null;
    this.oscFadeTimeoutId = setTimeout(() => {
      this.oscFadeTimeoutId = null;
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
      // Restore gain so the next startOscillator sees a clean state
      if (this.oscGainNode && this.ctx) {
        this.oscGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.oscGainNode.gain.setValueAtTime(this.oscGainLinear, this.ctx.currentTime);
      }
    }, fadeDuration * 1000 + 5);
  }

  setOscillatorGain(linear: number): void {
    this.oscGainLinear = linear;
    if (this.oscGainNode && this.ctx) {
      this.oscGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.oscGainNode.gain.setValueAtTime(linear, this.ctx.currentTime);
    }
  }

  setOscillatorFrequency(freq: number): void {
    if (!this.ctx || !this.currentOscillator) return;
    this.currentOscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);
  }

  startSweep(config: SweepConfig): void {
    if (!this.ctx || !this.currentOscillator) return;
    const { startFreq, endFreq, duration } = config;
    const now = this.ctx.currentTime;
    this.currentOscillator.frequency.cancelScheduledValues(now);
    this.currentOscillator.frequency.setValueAtTime(startFreq, now);
    this.currentOscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    if (this.sweepTimeoutId !== null) clearTimeout(this.sweepTimeoutId);
    this.sweepTimeoutId = setTimeout(() => {
      this.sweepTimeoutId = null;
    }, duration * 1000);
  }

  stopSweep(): void {
    if (!this.ctx || !this.currentOscillator) return;
    if (this.sweepTimeoutId !== null) {
      clearTimeout(this.sweepTimeoutId);
      this.sweepTimeoutId = null;
    }
    const now = this.ctx.currentTime;
    const currentFreq = this.currentOscillator.frequency.value;
    this.currentOscillator.frequency.cancelScheduledValues(now);
    this.currentOscillator.frequency.setValueAtTime(currentFreq, now);
  }

  getCurrentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  // ── File player ─────────────────────────────────────────────────────────────

  async loadFile(buffer: ArrayBuffer): Promise<void> {
    if (!this.ctx) return;
    this.stopFile();
    this.audioBuffer = await this.ctx.decodeAudioData(buffer);
  }

  async startFile(offset = 0, onEnded?: () => void): Promise<void> {
    if (!this.ctx || !this.fileGainNode || !this.audioBuffer) return;
    await this.resumeContext();
    this.masterGainNode?.gain.setValueAtTime(this.preampLinear, this.ctx.currentTime);

    // Stop existing source without resetting position state
    if (this.currentFileSource) {
      try { this.currentFileSource.stop(); } catch { /* already stopped */ }
      this.currentFileSource.disconnect();
      this.currentFileSource = null;
    }

    if (onEnded !== undefined) this.onFileEnded = onEnded;
    this.playbackOffset = Math.max(0, offset);
    this.playbackStartTime = this.ctx.currentTime;
    this.fileIsPlaying = true;

    const source = this.ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(this.fileGainNode);
    source.start(0, this.playbackOffset);
    source.onended = () => {
      if (this.currentFileSource === source) {
        this.currentFileSource = null;
        this.fileIsPlaying = false;
        this.playbackOffset = 0;
        this.onFileEnded?.();
      }
    };
    this.currentFileSource = source;
  }

  pauseFile(): void {
    if (this.fileIsPlaying) {
      this.playbackOffset = this.getFilePosition();
    }
    if (this.currentFileSource) {
      try { this.currentFileSource.stop(); } catch { /* already stopped */ }
      this.currentFileSource.disconnect();
      this.currentFileSource = null;
    }
    this.fileIsPlaying = false;
  }

  stopFile(): void {
    if (this.currentFileSource) {
      try { this.currentFileSource.stop(); } catch { /* already stopped */ }
      this.currentFileSource.disconnect();
      this.currentFileSource = null;
    }
    this.fileIsPlaying = false;
    this.playbackOffset = 0;
    this.onFileEnded = null;
  }

  async seekFile(position: number): Promise<void> {
    const wasPlaying = this.fileIsPlaying;
    if (this.currentFileSource) {
      try { this.currentFileSource.stop(); } catch { /* already stopped */ }
      this.currentFileSource.disconnect();
      this.currentFileSource = null;
    }
    this.fileIsPlaying = false;
    this.playbackOffset = Math.max(0, Math.min(position, this.audioBuffer?.duration ?? 0));
    if (wasPlaying) {
      await this.startFile(this.playbackOffset, this.onFileEnded ?? undefined);
    }
  }

  getFilePosition(): number {
    if (!this.ctx || !this.fileIsPlaying) return this.playbackOffset;
    return this.playbackOffset + (this.ctx.currentTime - this.playbackStartTime);
  }

  getFileDuration(): number {
    return this.audioBuffer?.duration ?? 0;
  }

  getIsFilePlaying(): boolean {
    return this.fileIsPlaying;
  }

  setFileEQEnabled(enabled: boolean): void {
    this.fileEQEnabled = enabled;
    this.rebuildChain();
  }

  hasAudioFile(): boolean {
    return this.audioBuffer !== null;
  }

  // ── EQ bands ────────────────────────────────────────────────────────────────

  addBand(): void {
    if (!this.ctx) return;
    const node = this.ctx.createBiquadFilter();
    node.type = 'peaking';
    node.frequency.value = 1000;
    node.gain.value = 0;
    node.Q.value = 1.0;
    this.filterNodes.push(node);
    this.rebuildChain();
  }

  removeBand(index: number): void {
    if (index < 0 || index >= this.filterNodes.length) return;
    this.filterNodes[index].disconnect();
    this.filterNodes.splice(index, 1);
    this.rebuildChain();
  }

  setBandType(index: number, type: FilterType): void {
    const node = this.filterNodes[index];
    if (!node) return;
    node.type = FILTER_TYPE_MAP[type];
  }

  setBandFrequency(index: number, freq: number): void {
    const node = this.filterNodes[index];
    if (!node) return;
    node.frequency.value = freq;
  }

  setBandGain(index: number, gain: number): void {
    const node = this.filterNodes[index];
    if (!node) return;
    node.gain.value = gain;
  }

  setBandQ(index: number, q: number): void {
    const node = this.filterNodes[index];
    if (!node) return;
    node.Q.value = q;
  }

  setBandEnabled(index: number, enabled: boolean, restoreGain = 0): void {
    const node = this.filterNodes[index];
    if (!node) return;
    node.gain.value = enabled ? restoreGain : 0;
  }

  getFilterNodes(): BiquadFilterNode[] {
    return this.filterNodes;
  }

  // ── Master ───────────────────────────────────────────────────────────────────

  setMasterGain(gain: number): void {
    this.preampLinear = gain;
    if (!this.ctx || !this.masterGainNode) return;
    this.masterGainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  get isInitialised(): boolean {
    return this.ctx !== null;
  }

  destroy(): void {
    if (this.oscFadeTimeoutId !== null) clearTimeout(this.oscFadeTimeoutId);
    this.stopOscillator();
    this.stopFile();
    this.ctx?.close();
    this.ctx = null;
    this.filterNodes = [];
    this.audioBuffer = null;
    this.bypassTrimNode = null;
  }
}
