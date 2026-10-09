/**
 * English copy. Tone: concise, warm, non-clinical. Someone who has never heard
 * of MBTI should be able to follow the captions.
 *
 * Person tokens are listed in format.ts. With "they" chosen, `{he}` reads
 * "they", so a pronoun subject only ever takes a past tense or a modal
 * ("what {he} meant"); present-tense verbs get the name instead.
 */
import type { Strings } from './types';

export const en: Strings = {
  title: 'The ISTP Ballpoint',
  subtitle: 'How a feeling gets from the inside to the page',

  intro: {
    heading: 'The ISTP Ballpoint',
    body: [
      'The laser is what you actually feel: the raw impulse, before anything is done with it. It passes through four instruments, one for each of the ways an ISTP is said to process the world, and finally out of a tiny ballpoint nib onto a sheet of paper: other people.',
      'When all three upstream instruments are working at once, the nib draws a glowing heart. Take any one away and the mark goes wrong in its own way.',
    ],
    disclaimer:
      'This is a model built on Jungian / MBTI typology (Ti → Se → Ni → Fe), offered as a way of thinking, not as scientific fact.',
    who: 'Who is the story about?',
    istp: 'The ISTP',
    other: 'With',
    istpPronouns: 'Pronouns for the ISTP',
    otherPronouns: 'Pronouns for the other person',
    story: 'Begin the story',
    sandbox: 'Explore freely',
  },

  pronouns: {
    he: { label: 'he', title: 'he / him / his' },
    she: { label: 'she', title: 'she / her / hers' },
    they: { label: 'they', title: 'they / them / their' },
  },
  language: { label: 'Language', names: { en: 'English', de: 'Deutsch' } },

  labels: {
    source: { name: 'The impulse', role: 'what {istp} actually feels' },
    ti: { name: 'Ti · introverted thinking', role: 'understands the structure' },
    se: { name: 'Se · extraverted sensing', role: 'compiles real-time data' },
    ni: { name: 'Ni · introverted intuition', role: 'compiles a direction' },
    fe: { name: 'Fe · extraverted feeling', role: 'writes what arrives' },
    sheet: { name: 'The page · {other}', role: 'what actually reaches {her}' },
  },

  condition: {
    tiAligned: 'aligned',
    tiSearching: (pct) => `searching · ${pct}%`,
    seSpinning: (pct) => `spinning · ${pct}%`,
    seStarved: 'starved',
    niPrimed: 'direction compiled',
    niCompiling: (pct) => `compiling · ${pct}%`,
    niFlat: 'no direction',
    niSagging: 'sagging',
    feIdle: 'waiting for a prompt',
    feWriting: 'writing',
    sourceIdle: 'humming',
    sourceCharged: 'charged',
  },

  markName: {
    scribble: 'burn-scribble',
    groove: 'dry groove',
    puddle: 'pink wash',
    heart: 'heart',
  },

  hud: {
    coherence: 'coherence',
    energy: 'energy',
    focus: 'focus',
    authenticity: 'authenticity',
    loop: 'Ti–Ni loop',
    dormant: 'dormant',
  },

  panel: {
    heading: 'Conditions',
    ti: 'Ti alignment',
    tiLock: 'Lock',
    tiAsk: 'Ask',
    tiShatter: 'Shatter',
    tiHint: 'or drag the knurled ring on the big lens',
    se: 'Se input',
    seFeed: 'Feed',
    seHint: 'or move the pointer through the scene, scroll, or hold F',
    ni: 'Ni direction',
    niCompile: 'Compile',
    niHint: 'or drop the target on the paper and let it rest a second',
    prompts: '{other} reaches out',
    spaceKey: 'Space',
    promptHint: 'repeats the last one',
    view: 'View',
    story: 'Story',
    reset: 'Reset',
    labels: 'Labels',
    mute: 'Sound',
    names: 'Names',
    namesDone: 'Done',
    collapse: 'Hide panel',
    expand: 'Controls',
  },

  prompts: {
    okay: { button: '{other} asks: “You okay?”', caption: '{other} asks: “You okay?”' },
    hurting: { button: '{other} is hurting', caption: '{other} is hurting.' },
    thanked: { button: '{other} thanks {him}, sincerely', caption: '{other} thanks {him}, sincerely.' },
  },

  caption: {
    incoming: '{prompt} The feeling enters at the source…',
    charging: 'The impulse brightens. Now it has to make it through.',
    drawing: {
      scribble: 'The beam hits the nib off-axis: out comes something blunt and reactive.',
      groove: 'Almost nothing reaches the nib. It drags a dry, colourless scratch: exhaustion.',
      puddle: 'The light arrives with no direction: a vague, pleasant wash with no edges.',
      heart: 'Everything holds. The nib draws a heart: the feeling, communicated as it is.',
    },
    idle: {
      scribble: 'Ti is still turning the problem over. The beam loops and scatters inside the big lens.',
      groove: 'Ti understands, but nothing fresh is coming in. The beam starves inside Ni: the Ti–Ni loop.',
      puddle: 'Understanding and energy are there, but Ni has no direction yet. Words would come out vague.',
      heart: 'All three hold. If {other} reaches out now, the feeling can land exactly where it’s meant to.',
    },
    dormant: 'Nothing holds: no structure, no input, no direction. The pipeline is dormant.',
  },

  story: {
    label: 'Story',
    acts: ['Act I · Together', 'Act II · The break', 'Act III · Repair'],
    skip: 'Skip',
    doIt: 'Do it for {istp}',
    doing: 'On it…',
    byHand: 'You did that yourself.',
    hints: {
      ask: 'Press Ask, or Q.',
      feed: 'Move the pointer through the scene, hold F, or press Feed.',
      compile: 'Drag the target on the page and let it rest, or press Compile.',
    },
    line: '“The guy that means a lot to me wrote me yesterday and we met up.”',
    questions: ['{istp}: “What did you mean?”', '{istp}: “What do you want?”', '{istp}: “What happens to us?”'],
    s1: {
      caption: '{istp} and {other} are on the sofa, close. {istp} understands what they have, knows where it is going, and feels it fully.',
      prompt: '{other}: “I like this.”',
      drawing: 'Saying it is easy. The nib writes exactly what {istp} feels.',
    },
    s2: {
      caption: '{other} says something that doesn’t fit the picture:',
      shattered: 'Ti’s model of the situation no longer holds. Everything {istp} thought {he} knew is back in pieces, being re-sorted.',
    },
    s3: {
      prompt: '{other}: “Say something?”',
      drawing: 'What comes out is blunt and off-axis. Not what {he} meant; what escaped.',
    },
    s4: {
      caption: 'They stop cuddling. No more live input reaches Se.',
      alone: 'Alone with it, Ti puts the pieces back together on its own: a picture built without asking.',
      loop: 'Without fresh data the wheel stops. Ti and Ni loop on each other.',
    },
    s5: {
      caption: 'Ni has nothing to work with. It lets go of the direction: no idea where this is going.',
      prompt: '{other} waits.',
      drawing: 'Nothing comes. {other} reads the silence as distance.',
      dormant: 'The picture Ti built alone doesn’t hold either. No structure, no input, no direction: the pipeline is dormant.',
    },
    s6: {
      caption: 'Ti needs a new structure, and it can only get one from {other}: {istp} has to ask.',
      done: 'Ti understands the new situation. Not the old one back; a new one.',
    },
    s7: {
      caption: 'Understanding alone changes nothing. Something has to happen between them again: {istp} moves closer; {other} leans in.',
      done: 'Live input again. The beam reaches the world.',
    },
    s8: {
      caption: 'Now Ni can compile a direction: where this is going, and what this moment is.',
      done: 'Direction compiled.',
    },
    s9: {
      prompt: '{other}: “So… how do you feel?”',
      drawing: 'Fe works again. Not because {istp} tried harder to feel. Because the three upstream conditions hold again.',
    },
    s10: {
      caption: 'That is the whole model: when expression fails, look upstream. Explore with the controls.',
    },
  },

  info: {
    source: {
      title: 'The impulse',
      body: [
        'The laser is the raw feeling: what {istp} actually feels, before anything is done with it.',
        'It is always on, humming faintly. When {other} reaches out, it brightens.',
        'Nothing about the impulse is wrong in any of the failure states. What changes is only what happens to it on the way out.',
      ],
    },
    ti: {
      title: 'Ti · introverted thinking (dominant)',
      body: [
        'The biggest, most intricate instrument: a mosaic of crystal facets that tries to understand how a situation actually works.',
        'In a conversation, this is {istp} quietly working out what is really going on before saying anything.',
        'Until it locks, the beam bounces around inside it. Ti isn’t broken, just busy. If someone needs a reply right now, what escapes is off-axis: blunt, reactive, uncalibrated.',
        'Drag the knurled ring toward the bright index mark. The facets settle, then snap flat. Or ask: each answer from {other} settles another third of the facets. Shatter shows what happens when something suddenly doesn’t fit.',
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
        'In a conversation, Ni is knowing what {istp} actually wants to say to {other}, and why.',
        'It can only extend when the beam from Ti is coherent, and it only stays extended while Se keeps the energy up. Without it, the feeling comes out as a vague, pleasant wash with no edges.',
        'Drag the target on the paper, then let it rest for a second. Moving it again scatters the direction.',
      ],
    },
    fe: {
      title: 'Fe · extraverted feeling (inferior)',
      body: [
        'The tiniest, most delicate part: a ballpoint nib with two little mirrors that steer the beam.',
        'Fe has no controls of its own. It only writes when {other} reaches out, and it can only write what arrives.',
        'That is the point of the whole model: when expression goes wrong, the nib is rarely the cause. Look upstream.',
      ],
    },
    sheet: {
      title: 'The page · {other}',
      body: [
        'The paper on the floor is {other}: what actually reaches {her}.',
        'Marks fade over about twenty seconds, so you can compare the last few attempts side by side.',
        'The target is where Ni is aiming. Drag it to choose where the feeling should land.',
      ],
    },
  },

  keys: {
    heading: 'Keys',
    list: [
      ['1', 'lock Ti'],
      ['⇧ 1', 'shatter Ti'],
      ['Q', 'ask: one question, one answer'],
      ['2', 'feed Se'],
      ['3', 'compile Ni'],
      ['Space', 'repeat prompt'],
      ['S', 'story'],
      ['R', 'reset'],
      ['L', 'labels'],
      ['M', 'sound'],
      ['← →', 'turn Ti ring while hovering it (keyboard: use the slider)'],
      ['Esc', 'close card'],
    ],
  },

  a11y: {
    scene: 'Interactive 3D scene: a laser passing through four instruments onto a sheet of paper',
    hud: 'Beam readout',
    panel: 'Controls',
    loop: 'Ti and Ni keep passing the beam back and forth: nothing reaches the world.',
    dormant: 'Ti unlocked, Se starved, Ni without a direction: nothing moves.',
    lock: 'Lock Ti alignment',
    ask: 'Ask {other} one question',
    shatter: 'Shatter Ti',
    feed: 'Feed Se a steady stream',
    compile: 'Compile Ni direction',
    skip: 'Skip the story',
    names: 'Edit the names',
    storyBar: 'Story',
  },

  close: 'Close',
  noWebGL: {
    heading: 'This piece needs WebGL',
    body: 'Your browser or device doesn’t seem to support WebGL, which this interactive 3D scene needs. Try a recent version of Chrome, Firefox, Safari or Edge, with hardware acceleration enabled.',
  },
};
