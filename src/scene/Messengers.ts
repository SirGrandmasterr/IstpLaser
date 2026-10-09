/**
 * Small orbs that carry words between Ti and the other person: the story's
 * line that breaks Ti's picture, and Ask's question going out and its answer
 * coming back. Purely visual; a flight calls back when it lands.
 *
 * Words to and from the other person come and go where prompts come from:
 * off to the left, toward the viewer. Questions are cyan (Ti's colour); what
 * comes back is white-pink, like a prompt.
 */
import { AdditiveBlending, Color, Sprite, SpriteMaterial, Vector3, type Scene } from 'three';
import { DIR, TI_POS } from './layout';
import type { Source } from './Source';
import { glowTexture } from './textures';

type Kind = 'question' | 'answer' | 'line';

const STYLE: Record<Kind, { core: Color; halo: Color; size: number; dur: number }> = {
  question: { core: new Color(0.7, 1.6, 2.0), halo: new Color(0.25, 0.75, 1.0), size: 0.3, dur: 1.15 },
  answer: { core: new Color(1.6, 1.25, 1.45), halo: new Color(1.0, 0.45, 0.7), size: 0.34, dur: 1.45 },
  line: { core: new Color(1.6, 1.25, 1.45), halo: new Color(1.0, 0.45, 0.7), size: 0.44, dur: 1.9 },
};
/** Seconds the story's line takes to reach Ti. */
export const LINE_FLIGHT = STYLE.line.dur;
/** Pause between a question leaving and its answer setting off. */
const THINK = 0.35;
/** A landing flares briefly at the target. */
const FLARE = 0.3;

interface Flight {
  kind: Kind;
  orb: Sprite;
  halo: Sprite;
  from: Vector3;
  ctrl: Vector3;
  to: Vector3;
  delay: number;
  t: number;
  /** Seconds since landing (flare), or −1 while in flight. */
  landed: number;
  done: (() => void) | null;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export class Messengers {
  private flights: Flight[] = [];
  private spare: Flight[] = [];
  private texture = glowTexture();

  constructor(
    private scene: Scene,
    private source: Source,
  ) {}

  get count(): number {
    return this.flights.length;
  }

  /** A little randomness, so repeated flights don't trace the same line. */
  private jitter(out: Vector3, k: number): Vector3 {
    return out.add(new Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k));
  }

  /**
   * A question leaves the source backwards and turns just behind it, toward the
   * viewer (where prompts come from); after a moment its answer returns into Ti.
   * The turn stays close enough to be in the story's Ti framing.
   */
  ask(onAnswer: () => void): void {
    const from = this.source.intake.clone();
    const turn = this.jitter(from.clone().add(new Vector3(-1.6, 0.6, 1.6)), 0.4);
    const ctrl = from.clone().addScaledVector(DIR, -1.0).add(new Vector3(0, 0.4, 0.4));
    this.launch('question', from, ctrl, turn, 0, () => {
      const back = turn.clone().add(new Vector3(0.2, -0.25, 0.15));
      const bend = back.clone().lerp(TI_POS, 0.5).add(new Vector3(0, 1.0, 0.6));
      this.launch('answer', back, bend, TI_POS.clone(), THINK, onAnswer);
    });
  }

  /** Something said from outside (front left) flies straight into Ti. */
  line(onArrive: () => void): void {
    const from = this.jitter(TI_POS.clone().add(new Vector3(-2.6, 0.1, 4.2)), 0.5);
    const ctrl = from.clone().lerp(TI_POS, 0.5).add(new Vector3(0, 0.9, 0.3));
    this.launch('line', from, ctrl, TI_POS.clone(), 0, onArrive);
  }

  private launch(kind: Kind, from: Vector3, ctrl: Vector3, to: Vector3, delay: number, done: () => void): void {
    let f = this.spare.pop();
    if (!f) {
      const mat = () => new SpriteMaterial({ map: this.texture, blending: AdditiveBlending, transparent: true, depthWrite: false });
      f = {
        kind,
        orb: new Sprite(mat()),
        halo: new Sprite(mat()),
        from,
        ctrl,
        to,
        delay,
        t: 0,
        landed: -1,
        done,
      };
      f.orb.renderOrder = f.halo.renderOrder = 12;
      this.scene.add(f.orb, f.halo);
    }
    Object.assign(f, { kind, from, ctrl, to, delay, t: 0, landed: -1, done });
    const st = STYLE[kind];
    f.orb.material.color.copy(st.core);
    f.halo.material.color.copy(st.halo);
    f.orb.visible = f.halo.visible = false;
    this.flights.push(f);
  }

  update(dt: number): void {
    const landed: (() => void)[] = [];
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      const st = STYLE[f.kind];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.orb.visible = f.halo.visible = true;
      if (f.landed < 0) {
        f.t = Math.min(1, f.t + dt / st.dur);
        const k = ease(f.t);
        const u = 1 - k;
        f.orb.position
          .copy(f.from)
          .multiplyScalar(u * u)
          .addScaledVector(f.ctrl, 2 * u * k)
          .addScaledVector(f.to, k * k);
        f.halo.position.copy(f.orb.position);
        // Fade in; a question fades out as it leaves toward the other person.
        let a = Math.min(1, f.t * 5);
        if (f.kind === 'question') a *= 1 - Math.max(0, (f.t - 0.6) / 0.4);
        f.orb.material.opacity = a;
        f.halo.material.opacity = 0.4 * a;
        f.orb.scale.setScalar(st.size);
        f.halo.scale.setScalar(st.size * 3.4);
        if (f.t >= 1) {
          f.landed = 0;
          if (f.done) landed.push(f.done);
          f.done = null;
        }
        continue;
      }
      // Landed: answers and lines flare at Ti; a question has already faded out.
      f.landed += dt;
      const k = Math.min(1, f.landed / FLARE);
      const flare = f.kind === 'question' ? 0 : 1 - k;
      f.orb.material.opacity = flare;
      f.halo.material.opacity = 0.5 * flare;
      f.orb.scale.setScalar(st.size * (1 + 1.6 * k));
      f.halo.scale.setScalar(st.size * 3.4 * (1 + 1.2 * k));
      if (k >= 1) this.retire(i);
    }
    for (const fn of landed) fn();
  }

  private retire(i: number): void {
    const f = this.flights[i];
    this.flights.splice(i, 1);
    f.orb.visible = f.halo.visible = false;
    f.done = null;
    this.spare.push(f);
  }

  /** Drop everything in flight without calling back. */
  clear(): void {
    for (let i = this.flights.length - 1; i >= 0; i--) this.retire(i);
  }
}
