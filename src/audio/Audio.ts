/**
 * Optional, muted-by-default procedural audio (Web Audio, no files):
 *   Ti lock click · Se hum scaled by spin · soft nib scratch · prompt chime.
 * The AudioContext is only created when the user first unmutes.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private humGain!: GainNode;
  private humOsc: OscillatorNode[] = [];
  private humFilter!: BiquadFilterNode;
  private scratchGain!: GainNode;
  private scratchFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  muted = true;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Se hum: two detuned saws through a low-pass.
    this.humFilter = ctx.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.value = 300;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    this.humFilter.connect(this.humGain).connect(this.master);
    for (const det of [-6, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      o.detune.value = det;
      o.connect(this.humFilter);
      o.start();
      this.humOsc.push(o);
    }

    // Nib scratch: looped noise through a band-pass.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.scratchFilter = ctx.createBiquadFilter();
    this.scratchFilter.type = 'bandpass';
    this.scratchFilter.frequency.value = 2400;
    this.scratchFilter.Q.value = 1.4;
    this.scratchGain = ctx.createGain();
    this.scratchGain.gain.value = 0;
    src.connect(this.scratchFilter).connect(this.scratchGain).connect(this.master);
    src.start();
    return ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) {
      const ctx = this.ensure();
      if (!ctx) return;
      void ctx.resume();
    }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  private get live(): AudioContext | null {
    return !this.muted && this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  /** A small, precise mechanical click: Ti snapping into lock. */
  click(): void {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.06);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  /** Soft two-note chime as a prompt reaches the source. */
  chime(): void {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, delay] of [
      [659.25, 0],
      [987.77, 0.09],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.09, t + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.4);
      o.connect(g).connect(this.master);
      o.start(t + delay);
      o.stop(t + delay + 1.5);
    }
  }

  /**
   * Continuous layers, called every frame.
   * @param spin  Se normalised angular velocity
   * @param nib   0..1 how hard the nib is writing
   * @param tone  0 = dry scratch (high, thin), 1 = smooth glide (soft, low)
   */
  update(spin: number, nib: number, tone: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.humGain.gain.setTargetAtTime(0.05 * spin * spin + 0.012 * spin, t, 0.1);
    for (const o of this.humOsc) o.frequency.setTargetAtTime(48 + 70 * spin, t, 0.15);
    this.humFilter.frequency.setTargetAtTime(180 + 900 * spin, t, 0.15);
    this.scratchGain.gain.setTargetAtTime(nib * (0.06 + 0.05 * (1 - tone)), t, 0.04);
    this.scratchFilter.frequency.setTargetAtTime(1200 + 3200 * (1 - tone), t, 0.05);
  }
}
