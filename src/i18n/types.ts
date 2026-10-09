/**
 * The shape every language file fills in. Person-referring strings are
 * templates; see format.ts for the tokens. Strings end up in `textContent`,
 * never in HTML.
 */
import type { OutputMode } from '../model/beam';

export type Lang = 'en' | 'de';
export const LANGS: readonly Lang[] = ['en', 'de'];

export type Pronoun = 'he' | 'she' | 'they';
export const PRONOUNS: readonly Pronoun[] = ['he', 'she', 'they'];

export interface Person {
  name: string;
  pronoun: Pronoun;
}

/** The ISTP the story is about, and the person they are with. */
export interface People {
  istp: Person;
  other: Person;
}

export type InstrumentId = 'source' | 'ti' | 'se' | 'ni' | 'fe' | 'sheet';
export type PromptKind = 'okay' | 'hurting' | 'thanked';

type Pct = (pct: number) => string;

export interface Strings {
  title: string;
  subtitle: string;

  intro: {
    heading: string;
    body: string[];
    disclaimer: string;
    who: string;
    istp: string;
    other: string;
    istpPronouns: string;
    otherPronouns: string;
    story: string;
    sandbox: string;
  };

  /** Label and tooltip for each pronoun choice. */
  pronouns: Record<Pronoun, { label: string; title: string }>;
  language: { label: string; names: Record<Lang, string> };

  labels: Record<InstrumentId, { name: string; role: string }>;

  condition: {
    tiAligned: string;
    tiSearching: Pct;
    seSpinning: Pct;
    seStarved: string;
    niPrimed: string;
    niCompiling: Pct;
    niFlat: string;
    niSagging: string;
    feIdle: string;
    feWriting: string;
    sourceIdle: string;
    sourceCharged: string;
  };

  markName: Record<OutputMode, string>;

  hud: {
    coherence: string;
    energy: string;
    focus: string;
    authenticity: string;
    loop: string;
    dormant: string;
  };

  panel: {
    heading: string;
    ti: string;
    tiLock: string;
    tiAsk: string;
    tiShatter: string;
    tiHint: string;
    se: string;
    seFeed: string;
    seHint: string;
    ni: string;
    niCompile: string;
    niHint: string;
    prompts: string;
    /** The space bar's name, and what it does here. */
    spaceKey: string;
    promptHint: string;
    view: string;
    story: string;
    reset: string;
    labels: string;
    mute: string;
    names: string;
    namesDone: string;
    collapse: string;
    expand: string;
  };

  prompts: Record<PromptKind, { button: string; caption: string }>;

  /** The one-line state caption (sandbox). */
  caption: {
    /** `{prompt}` is the prompt's caption. */
    incoming: string;
    charging: string;
    drawing: Record<OutputMode, string>;
    idle: Record<OutputMode, string>;
    dormant: string;
  };

  story: {
    label: string;
    acts: [string, string, string];
    skip: string;
    doIt: string;
    doing: string;
    /** The bar's one-line acknowledgement when the user did a step by hand. */
    byHand: string;
    hints: { ask: string; feed: string; compile: string };
    /** What the companion says that breaks Ti's picture. Deliberately ambiguous. */
    line: string;
    questions: [string, string, string];
    s1: { caption: string; prompt: string; drawing: string };
    s2: { caption: string; shattered: string };
    s3: { prompt: string; drawing: string };
    s4: { caption: string; alone: string; loop: string };
    s5: { caption: string; prompt: string; drawing: string; dormant: string };
    s6: { caption: string; done: string };
    s7: { caption: string; done: string };
    s8: { caption: string; done: string };
    s9: { prompt: string; drawing: string };
    s10: { caption: string };
  };

  info: Record<InstrumentId, { title: string; body: string[] }>;

  keys: { heading: string; list: [string, string][] };

  a11y: {
    scene: string;
    hud: string;
    panel: string;
    loop: string;
    dormant: string;
    lock: string;
    ask: string;
    shatter: string;
    feed: string;
    compile: string;
    skip: string;
    names: string;
    storyBar: string;
  };

  close: string;
  noWebGL: { heading: string; body: string };
}
