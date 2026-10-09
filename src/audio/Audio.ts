/**
 * Optional, muted-by-default procedural audio (Web Audio, no files):
 *   Ti lock click · Ti shatter crack · Se hum scaled by spin · nib scratch · prompt chime.
 * The AudioContext is only created when the user first unmutes.
 *
 * Levels: the hum sits well under the click (and ducks for it); the nib only
 * makes a sound when it touches the paper (a dry groove scratches quietly, a
 * burn crackles); writing with light (wash, heart) is a silent glide.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private humGain!: GainNode;
  private humDuck!: GainNode;
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
    this.humDuck = ctx.createGain();
    this.humFilter.connect(this.humGain).connect(this.humDuck).connect(this.master);
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
    // Duck the hum so the click is never masked by a spinning Se.
    this.humDuck.gain.cancelScheduledValues(t);
    this.humDuck.gain.setValueAtTime(0.25, t);
    this.humDuck.gain.linearRampToValueAtTime(1, t + 0.3);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.06);
    // A short metallic tick well above the hum's band.
    const tick = ctx.createOscillator();
    tick.type = 'sine';
    tick.frequency.value = 2650;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.12, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    tick.connect(tg).connect(this.master);
    tick.start(t);
    tick.stop(t + 0.06);
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

  /** Ti's picture breaking: a dry glassy crack, the lock's thunk run backwards (rising). */
  crack(): void {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.humDuck.gain.cancelScheduledValues(t);
    this.humDuck.gain.setValueAtTime(0.2, t);
    this.humDuck.gain.linearRampToValueAtTime(1, t + 0.5);
    // Two splintering bursts of bright noise, a few ms apart.
    for (const [delay, level, f] of [
      [0, 0.8, 5200],
      [0.035, 0.45, 3600],
    ] as const) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.16);
      src.connect(hp).connect(g).connect(this.master);
      src.start(t + delay, Math.random(), 0.2);
    }
    // The click's low thunk, reversed: it swells and rises instead of dropping.
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.001, t);
    og.gain.exponentialRampToValueAtTime(0.3, t + 0.1);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.18);
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
   * @param nib   0..1 how hard the nib is pressing
   * @param dry   0..1 how much of the stroke is a dry score (the ball dragging on paper)
   * @param burn  0..1 how much of the stroke is a burn
   */
  update(spin: number, nib: number, dry: number, burn: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.humGain.gain.setTargetAtTime(0.04 * spin * spin + 0.01 * spin, t, 0.1);
    for (const o of this.humOsc) o.frequency.setTargetAtTime(48 + 70 * spin, t, 0.15);
    this.humFilter.frequency.setTargetAtTime(180 + 700 * spin, t, 0.15);
    // A burn crackles: the level flickers frame to frame.
    const crackle = burn * (0.3 + 0.7 * Math.random());
    const contact = Math.min(1, dry + burn);
    this.scratchGain.gain.setTargetAtTime(nib * (0.05 * dry + 0.035 * crackle), t, 0.03);
    this.scratchFilter.frequency.setTargetAtTime(3400 - 1600 * (burn / Math.max(1e-3, contact)), t, 0.05);
  }
}
