/**
 * All user-facing copy lives here so the piece can be translated in one place.
 * Tone: concise, warm, non-clinical. Someone who has never heard of MBTI should
 * be able to follow the captions.
 */
import type { OutputMode } from './model/beam';

export type InstrumentId = 'source' | 'ti' | 'se' | 'ni' | 'fe' | 'sheet';
export type PromptKind = 'okay' | 'hurting' | 'thanked';

export const S = {
  title: 'The ISTP Ballpoint',
  subtitle: 'How a feeling gets from the inside to the page',

  intro: {
    heading: 'The ISTP Ballpoint',
    body: [
      'A laser is something you actually feel. It passes through four instruments, one for each of the ways an ISTP is said to process the world, and finally out of a tiny ballpoint nib onto a sheet of paper: other people.',
      'When all three upstream instruments are working at once, the nib draws a glowing heart. Take any one away and the mark goes wrong in its own way.',
    ],
    disclaimer:
      'This is a model built on Jungian / MBTI typology (Ti → Se → Ni → Fe), offered as a way of thinking, not as scientific fact.',
    story: 'Begin the story',
    sandbox: 'Explore freely',
    storyKey: 'S',
  },

  labels: {
    source: { name: 'The impulse', role: 'what is actually felt' },
    ti: { name: 'Ti · introverted thinking', role: 'understands the structure' },
    se: { name: 'Se · extraverted sensing', role: 'compiles real-time data' },
    ni: { name: 'Ni · introverted intuition', role: 'compiles a direction' },
    fe: { name: 'Fe · extraverted feeling', role: 'writes what arrives' },
    sheet: { name: 'The page', role: 'other people' },
  } satisfies Record<InstrumentId, { name: string; role: string }>,

  condition: {
    tiAligned: 'aligned',
    tiSearching: (pct: number) => `searching · ${pct}%`,
    seSpinning: (pct: number) => `spinning · ${pct}%`,
    seStarved: 'starved',
    niPrimed: 'direction compiled',
    niCompiling: (pct: number) => `compiling · ${pct}%`,
    niFlat: 'no direction',
    niSagging: 'sagging',
    feIdle: 'waiting for a prompt',
    feWriting: 'writing',
    sourceIdle: 'humming',
    sourceCharged: 'charged',
    sheet: (mode: OutputMode) => S.markName[mode],
  },

  markName: {
    scribble: 'burn-scribble',
    groove: 'dry groove',
    puddle: 'pink wash',
    heart: 'heart',
  } satisfies Record<OutputMode, string>,

  hud: {
    coherence: 'coherence',
    energy: 'energy',
    focus: 'focus',
    authenticity: 'authenticity',
    loop: 'Ti–Ni loop',
  },

  panel: {
    heading: 'Conditions',
    ti: 'Ti alignment',
    tiLock: 'Lock',
    tiHint: 'or drag the knurled ring on the big lens',
    se: 'Se input',
    seFeed: 'Feed',
    seHint: 'or move the pointer through the scene, scroll, or hold F',
    ni: 'Ni direction',
    niCompile: 'Compile',
    niHint: 'or drag the target on the paper and hold it still',
    prompts: 'Someone reaches out',
    promptHint: 'Space repeats the last one',
    view: 'View',
    story: 'Story',
    reset: 'Reset',
    labels: 'Labels',
    mute: 'Sound',
    collapse: 'Hide panel',
    expand: 'Controls',
  },

  prompts: {
    okay: { button: 'A friend asks: “You okay?”', caption: 'A friend asks: “You okay?”' },
    hurting: { button: 'Someone you love is hurting', caption: 'Someone you love is hurting.' },
    thanked: { button: 'You’re thanked, sincerely', caption: 'You’re thanked, sincerely.' },
  } satisfies Record<PromptKind, { button: string; caption: string }>,

  /** The one-line state caption, always visible. */
  caption: {
    incoming: (who: string) => `${who} The feeling enters at the source…`,
    charging: 'The impulse brightens. Now it has to make it through.',
    drawing: {
      scribble: 'The beam hits the nib off-axis: out comes something blunt and reactive.',
      groove: 'Almost nothing reaches the nib. It drags a dry, colourless scratch: exhaustion.',
      puddle: 'The light arrives with no direction: a vague, pleasant wash with no edges.',
      heart: 'Everything holds. The nib draws a heart: the feeling, communicated as it is.',
    } satisfies Record<OutputMode, string>,
    idle: {
      scribble: 'Ti is still turning the problem over. The beam loops and scatters inside the big lens.',
      groove: 'Ti understands, but nothing fresh is coming in. The beam starves inside Ni: the Ti–Ni loop.',
      puddle: 'Understanding and energy are there, but Ni has no direction yet. Words would come out vague.',
      heart: 'All three hold. If someone reaches out now, the feeling can land exactly where it’s meant to.',
    } satisfies Record<OutputMode, string>,
  },

  story: {
    label: 'Story',
    skip: 'Skip',
    next: 'Next',
    scenes: [
      'Ti turns the problem over, looping the beam inside itself.',
      'Ti hasn’t understood the shape of the situation. The beam hits Fe off-axis: a blunt, reactive remark.',
      'Ti understands. But no fresh data reaches Se. The beam starves before it reaches the world. Ti and Ni loop on each other.',
      'Energy is back, but Ni has no compiled direction. Fe projects a vague pink wash.',
      'All three locked. Fe draws a heart: a feeling, communicated.',
      'Explore with the controls.',
    ],
  },

  info: {
    source: {
      title: 'The impulse',
      body: [
        'The laser is the raw feeling: what is actually there before anything is done with it.',
        'It is always on, humming faintly. When someone reaches out, it brightens.',
        'Nothing about the impulse is wrong in any of the failure states. What changes is only what happens to it on the way out.',
      ],
    },
    ti: {
      title: 'Ti · introverted thinking (dominant)',
      body: [
        'The biggest, most intricate instrument: a mosaic of crystal facets that tries to understand how a situation actually works.',
        'In a conversation, this is the ISTP quietly working out what is really going on before saying anything.',
        'Until it locks, the beam bounces around inside it. Ti isn’t broken, just busy. If someone needs a reply right now, what escapes is off-axis: blunt, reactive, uncalibrated.',
        'Drag the knurled ring toward the bright index mark. The facets settle, then snap flat.',
      ],
    },
    se: {
      title: 'Se · extraverted sensing (auxiliary)',
      body: [
        'A flywheel that only turns when the outside world hits it. It is the one instrument fed from outside the beam.',
        'In a conversation, Se is being present: noticing the face, the voice, the room, in real time. That live input is what gives the feeling energy.',
        'Without it the wheel coasts to a stop in a few seconds and the beam dies before it reaches anyone. Ti and Ni loop on each other, and nothing comes out: just exhaustion.',
        'Move your pointer through the scene to throw particles at it, or switch on the steady feed.',
      ],
    },
    ni: {
      title: 'Ni · introverted intuition (tertiary)',
      body: [
        'A small lens that decides where the feeling is meant to go. Flat, it scatters the beam in every direction; primed, it telescopes into a barrel that points.',
        'In a conversation, Ni is knowing what you actually want to say to this person, and why.',
        'It can only extend when the beam from Ti is coherent, and it only stays extended while Se keeps the energy up. Without it, the feeling comes out as a vague, pleasant wash with no edges.',
        'Drag the target on the paper and hold it still for a second.',
      ],
    },
    fe: {
      title: 'Fe · extraverted feeling (inferior)',
      body: [
        'The tiniest, most delicate part: a ballpoint nib with two little mirrors that steer the beam.',
        'Fe has no controls of its own. It only writes when someone reaches out, and it can only write what arrives.',
        'That is the point of the whole model: when expression goes wrong, the nib is rarely the cause. Look upstream.',
      ],
    },
    sheet: {
      title: 'The page',
      body: [
        'The paper on the floor is the social world: other people, and what they actually receive.',
        'Marks fade over about twenty seconds, so you can compare the last few attempts side by side.',
        'The target is where Ni is aiming. Drag it to choose where the feeling should land.',
      ],
    },
  } satisfies Record<InstrumentId, { title: string; body: string[] }>,

  keys: {
    heading: 'Keys',
    list: [
      ['1', 'lock Ti'],
      ['2', 'feed Se'],
      ['3', 'compile Ni'],
      ['Space', 'repeat prompt'],
      ['S', 'story'],
      ['R', 'reset'],
      ['L', 'labels'],
      ['M', 'sound'],
      ['← →', 'turn Ti ring (hover)'],
      ['Esc', 'close card'],
    ] as [string, string][],
  },

  close: 'Close',
  noWebGL: {
    heading: 'This piece needs WebGL',
    body: 'Your browser or device doesn’t seem to support WebGL, which this interactive 3D scene needs. Try a recent version of Chrome, Firefox, Safari or Edge, with hardware acceleration enabled.',
  },
};
