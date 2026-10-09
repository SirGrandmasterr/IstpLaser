/**
 * Deutsche Texte. Register: „du“, die Geschichte ist nah und persönlich.
 *
 * Tokens wie in format.ts: {he}/{she} stehen im Nominativ (er, sie), {him}/{her}
 * im Dativ (ihm, ihr); bei „neutral“ steht der Name. Possessivpronomen kommen
 * nicht vor, stattdessen der Name im Genitiv ({istpGen}, {otherGen}). Kein
 * Akkusativ-Pronomen, und kein Pronomen am Satzanfang (Verwechslung mit „Sie“).
 */
import type { Strings } from './types';

export const de: Strings = {
  title: 'The ISTP Ballpoint',
  subtitle: 'Wie ein Gefühl von innen auf die Seite kommt',

  intro: {
    heading: 'The ISTP Ballpoint',
    body: [
      'Der Laser ist das, was du tatsächlich fühlst: der rohe Impuls, bevor irgendetwas damit geschieht. Er läuft durch vier Instrumente, je eines für die vier Arten, auf die ein ISTP der Typologie nach die Welt verarbeitet, und tritt am Ende aus einer winzigen Kugelschreiberspitze auf ein Blatt Papier: die anderen Menschen.',
      'Funktionieren alle drei vorgelagerten Instrumente gleichzeitig, zeichnet die Spitze ein leuchtendes Herz. Fällt eines davon aus, geht die Spur auf ihre ganz eigene Weise schief.',
    ],
    disclaimer:
      'Ein Modell auf Grundlage der Typologie nach Jung bzw. MBTI (Ti → Se → Ni → Fe): ein Denkangebot, keine wissenschaftliche Tatsache.',
    who: 'Um wen geht es?',
    istp: 'ISTP',
    other: 'Mit',
    istpPronouns: 'Pronomen für die ISTP-Person',
    otherPronouns: 'Pronomen für das Gegenüber',
    story: 'Geschichte starten',
    sandbox: 'Frei erkunden',
  },

  pronouns: {
    he: { label: 'er', title: 'er / ihm' },
    she: { label: 'sie', title: 'sie / ihr' },
    they: { label: 'neutral', title: 'kein Pronomen, immer der Name' },
  },
  language: { label: 'Sprache', names: { en: 'English', de: 'Deutsch' } },

  labels: {
    source: { name: 'Der Impuls', role: 'was {istp} tatsächlich fühlt' },
    ti: { name: 'Ti · introvertiertes Denken', role: 'versteht die Struktur' },
    se: { name: 'Se · extravertiertes Empfinden', role: 'sammelt Echtzeitdaten' },
    ni: { name: 'Ni · introvertierte Intuition', role: 'bündelt eine Richtung' },
    fe: { name: 'Fe · extravertiertes Fühlen', role: 'schreibt, was ankommt' },
    sheet: { name: 'Die Seite · {other}', role: 'was bei {her} ankommt' },
  },

  condition: {
    tiAligned: 'ausgerichtet',
    tiSearching: (pct) => `sucht · ${pct} %`,
    seSpinning: (pct) => `dreht · ${pct} %`,
    seStarved: 'ausgehungert',
    niPrimed: 'Richtung gebündelt',
    niCompiling: (pct) => `bündelt · ${pct} %`,
    niFlat: 'keine Richtung',
    niSagging: 'sackt ab',
    feIdle: 'wartet auf einen Anstoß',
    feWriting: 'schreibt',
    sourceIdle: 'summt',
    sourceCharged: 'geladen',
  },

  markName: {
    scribble: 'Brandgekritzel',
    groove: 'trockene Rille',
    puddle: 'rosa Schleier',
    heart: 'Herz',
  },

  hud: {
    coherence: 'Kohärenz',
    energy: 'Energie',
    focus: 'Fokus',
    authenticity: 'Echtheit',
    loop: 'Ti–Ni-Schleife',
    dormant: 'Stillstand',
  },

  panel: {
    heading: 'Bedingungen',
    ti: 'Ti-Ausrichtung',
    tiLock: 'Einrasten',
    tiAsk: 'Fragen',
    tiShatter: 'Zerbrechen',
    tiHint: 'oder den Rändelring an der großen Linse drehen',
    se: 'Se-Input',
    seFeed: 'Zufuhr',
    seHint: 'oder den Zeiger durch die Szene bewegen, scrollen oder F gedrückt halten',
    ni: 'Ni-Richtung',
    niCompile: 'Bündeln',
    niHint: 'oder das Ziel aufs Papier legen und eine Sekunde ruhen lassen',
    prompts: '{other} sucht Kontakt',
    spaceKey: 'Leertaste',
    promptHint: 'wiederholt den letzten',
    view: 'Ansicht',
    story: 'Geschichte',
    reset: 'Neustart',
    labels: 'Schilder',
    mute: 'Ton',
    names: 'Namen',
    namesDone: 'Fertig',
    collapse: 'Ausblenden',
    expand: 'Steuerung',
  },

  prompts: {
    okay: { button: '{other} fragt: „Alles okay?“', caption: '{other} fragt: „Alles okay?“' },
    hurting: { button: '{other} geht es schlecht', caption: '{other} geht es schlecht.' },
    thanked: { button: '{other} dankt {him} von Herzen', caption: '{other} dankt {him} von Herzen.' },
  },

  caption: {
    incoming: '{prompt} Das Gefühl tritt an der Quelle ein …',
    charging: 'Der Impuls wird heller. Jetzt muss er durchkommen.',
    drawing: {
      scribble: 'Der Strahl trifft die Spitze schräg: Heraus kommt etwas Schroffes, Reaktives.',
      groove: 'Fast nichts erreicht die Spitze. Sie zieht eine trockene, farblose Rille: Erschöpfung.',
      puddle: 'Das Licht kommt ohne Richtung an: ein vager, freundlicher Schleier ohne Kanten.',
      heart: 'Alles hält. Die Spitze zeichnet ein Herz: das Gefühl, mitgeteilt, wie es ist.',
    },
    idle: {
      scribble: 'Ti wälzt das Problem noch hin und her. Der Strahl kreist und streut in der großen Linse.',
      groove: 'Ti versteht, aber es kommt nichts Frisches herein. Der Strahl verhungert in Ni: die Ti–Ni-Schleife.',
      puddle: 'Verständnis und Energie sind da, aber Ni hat noch keine Richtung. Worte kämen vage heraus.',
      heart: 'Alle drei halten. Wenn {other} sich jetzt meldet, kann das Gefühl genau dort landen, wo es hin soll.',
    },
    dormant: 'Nichts hält: keine Struktur, kein Input, keine Richtung. Die Pipeline steht still.',
  },

  story: {
    label: 'Geschichte',
    acts: ['Akt I · Zusammen', 'Akt II · Der Bruch', 'Akt III · Die Reparatur'],
    skip: 'Überspringen',
    doIt: 'Für {istp} übernehmen',
    doing: 'Wird erledigt …',
    byHand: 'Das hast du selbst geschafft.',
    hints: {
      ask: 'Drück auf „Fragen“ oder Q.',
      feed: 'Beweg den Zeiger durch die Szene, halte F gedrückt oder drück auf „Zufuhr“.',
      compile: 'Zieh das Ziel auf der Seite und lass es ruhen, oder drück auf „Bündeln“.',
    },
    line: '„Ich überlege schon eine Weile, wegzuziehen.“',
    questions: ['{istp}: „Wie hast du das gemeint?“', '{istp}: „Was wünschst du dir?“', '{istp}: „Was heißt das für uns?“'],
    s1: {
      caption: '{istp} und {other} sitzen eng beieinander auf dem Sofa. {istp} versteht, was die beiden haben, weiß, wohin es geht, und fühlt es voll und ganz.',
      prompt: '{other}: „Das ist schön.“',
      drawing: 'Es auszusprechen ist leicht. Die Spitze schreibt genau das, was {istp} fühlt.',
    },
    s2: {
      caption: '{other} sagt etwas, das nicht ins Bild passt:',
      shattered: 'Das Bild, das Ti sich von der Lage gemacht hat, stimmt nicht mehr. Alles, was {istp} zu wissen glaubte, liegt wieder in Einzelteilen und wird neu sortiert.',
    },
    s3: {
      prompt: '{other}: „Sagst du was?“',
      drawing: 'Was herauskommt, ist schroff und schief: nicht das, was {he} meint, sondern was gerade entwischt.',
    },
    s4: {
      caption: 'Die beiden hören auf zu kuscheln. Kein frischer Input erreicht mehr Se.',
      alone: 'Allein damit setzt Ti die Teile selbst wieder zusammen: ein Bild, ganz ohne nachzufragen.',
      loop: 'Ohne frische Daten bleibt das Rad stehen. Ti und Ni drehen sich gegenseitig im Kreis.',
    },
    s5: {
      caption: 'Ni hat nichts, womit es arbeiten könnte. Es lässt die Richtung los: keine Ahnung, wohin das führt.',
      prompt: '{other} wartet.',
      drawing: 'Es kommt nichts. {other} deutet das Schweigen als Distanz.',
      dormant: 'Auch das Bild, das Ti allein gebaut hat, hält nicht. Keine Struktur, kein Input, keine Richtung: Die Pipeline steht still.',
    },
    s6: {
      caption: 'Ti braucht eine neue Struktur, und die bekommt es nur von {other}: {istp} muss fragen.',
      done: 'Ti versteht die neue Lage. Nicht die alte zurück, sondern eine neue.',
    },
    s7: {
      caption: 'Verstehen allein ändert nichts. Zwischen den beiden muss wieder etwas passieren: {istp} rückt näher, {other} lehnt sich an.',
      done: 'Wieder echter Input. Der Strahl erreicht die Welt.',
    },
    s8: {
      caption: 'Jetzt kann Ni eine Richtung bündeln: wohin das führt und was dieser Moment ist.',
      done: 'Richtung gebündelt.',
    },
    s9: {
      prompt: '{other}: „Und … was fühlst du?“',
      drawing: 'Fe funktioniert wieder. Nicht, weil {istp} sich beim Fühlen mehr Mühe gegeben hat, sondern weil die drei vorgelagerten Bedingungen wieder erfüllt sind.',
    },
    s10: {
      caption: 'Das ist das ganze Modell: Wenn der Ausdruck scheitert, liegt die Ursache weiter vorn. Probier die Regler selbst aus.',
    },
  },

  info: {
    source: {
      title: 'Der Impuls',
      body: [
        'Der Laser ist das rohe Gefühl: das, was {istp} tatsächlich fühlt, bevor irgendetwas damit geschieht.',
        'Er ist immer an und summt leise. Wenn {other} sich meldet, wird er heller.',
        'In keinem der Fehlerzustände ist am Impuls selbst etwas falsch. Es ändert sich nur, was ihm auf dem Weg nach draußen passiert.',
      ],
    },
    ti: {
      title: 'Ti · introvertiertes Denken (dominant)',
      body: [
        'Das größte und feinste Instrument: ein Mosaik aus Kristallfacetten, das zu verstehen versucht, wie eine Situation tatsächlich funktioniert.',
        'Im Gespräch ist das der Moment, in dem {istp} still herausfindet, was eigentlich los ist, bevor etwas gesagt wird.',
        'Solange es nicht einrastet, springt der Strahl darin hin und her. Ti ist nicht kaputt, nur beschäftigt. Braucht jemand sofort eine Antwort, kommt schief heraus, was gerade entwischt: schroff, reaktiv, unkalibriert.',
        'Dreh den Rändelring zur hellen Indexmarke: Die Facetten beruhigen sich und rasten dann flach ein. Oder frag nach: Jede Antwort von {other} bringt ein weiteres Drittel der Facetten zur Ruhe. „Zerbrechen“ zeigt, was passiert, wenn plötzlich nichts mehr ins Bild passt.',
      ],
    },
    se: {
      title: 'Se · extravertiertes Empfinden (Hilfsfunktion)',
      body: [
        'Ein Schwungrad, das sich nur dreht, wenn die Außenwelt es trifft. Es ist das einzige Instrument, das von außerhalb des Strahls gespeist wird.',
        'Im Gespräch heißt Se: präsent sein. Das Gesicht, die Stimme, den Raum in Echtzeit wahrnehmen. Dieser lebendige Input gibt dem Gefühl seine Energie.',
        'Ohne ihn läuft das Rad in wenigen Sekunden aus, und der Strahl erlischt, bevor er irgendwen erreicht. Ti und Ni drehen sich im Kreis, und nichts kommt heraus: nur Erschöpfung.',
        'Beweg den Zeiger durch die Szene, um Teilchen darauf zu werfen, oder schalte die stetige Zufuhr ein.',
      ],
    },
    ni: {
      title: 'Ni · introvertierte Intuition (tertiär)',
      body: [
        'Eine kleine Linse, die entscheidet, wohin das Gefühl gehen soll. Flach streut sie den Strahl in alle Richtungen; gebündelt fährt sie zu einem Tubus aus, der zielt.',
        'Im Gespräch ist Ni das Wissen, was {istp} {other} eigentlich sagen will, und warum.',
        'Ausfahren kann sie nur, wenn der Strahl aus Ti kohärent ist, und ausgefahren bleibt sie nur, solange Se die Energie hochhält. Ohne sie kommt das Gefühl als vager, freundlicher Schleier ohne Kanten heraus.',
        'Zieh das Ziel auf dem Papier und lass es eine Sekunde ruhen. Bewegst du es wieder, zerstreut sich die Richtung.',
      ],
    },
    fe: {
      title: 'Fe · extravertiertes Fühlen (inferior)',
      body: [
        'Der kleinste, empfindlichste Teil: eine Kugelschreiberspitze mit zwei winzigen Spiegeln, die den Strahl lenken.',
        'Fe hat keine eigenen Regler. Es schreibt nur, wenn {other} sich meldet, und es kann nur schreiben, was ankommt.',
        'Darum geht es im ganzen Modell: Wenn der Ausdruck schiefgeht, liegt es selten an der Spitze. Die Ursache liegt weiter vorn.',
      ],
    },
    sheet: {
      title: 'Die Seite · {other}',
      body: [
        'Das Papier auf dem Boden ist {other}: das, was tatsächlich bei {her} ankommt.',
        'Spuren verblassen in etwa zwanzig Sekunden, so lassen sich die letzten Versuche nebeneinander vergleichen.',
        'Das Ziel zeigt, wohin Ni zielt. Zieh es dorthin, wo das Gefühl ankommen soll.',
      ],
    },
  },

  keys: {
    heading: 'Tasten',
    list: [
      ['1', 'Ti einrasten'],
      ['⇧ 1', 'Ti zerbrechen'],
      ['Q', 'fragen: eine Frage, eine Antwort'],
      ['2', 'Se-Zufuhr'],
      ['3', 'Ni bündeln'],
      ['Leertaste', 'Anstoß wiederholen'],
      ['S', 'Geschichte'],
      ['R', 'Neustart'],
      ['L', 'Schilder'],
      ['M', 'Ton'],
      ['← →', 'Ti-Ring drehen, solange der Zeiger darauf liegt (Tastatur: Schieberegler)'],
      ['Esc', 'Karte schließen'],
    ],
  },

  a11y: {
    scene: 'Interaktive 3D-Szene: Ein Laser läuft durch vier Instrumente auf ein Blatt Papier',
    hud: 'Strahlanzeige',
    panel: 'Steuerung',
    loop: 'Ti und Ni reichen den Strahl hin und her: Nichts erreicht die Welt.',
    dormant: 'Ti offen, Se ausgehungert, Ni ohne Richtung: Nichts bewegt sich.',
    lock: 'Ti-Ausrichtung einrasten',
    ask: '{other} eine Frage stellen',
    shatter: 'Ti zerbrechen',
    feed: 'Se stetig füttern',
    compile: 'Ni-Richtung bündeln',
    skip: 'Geschichte überspringen',
    names: 'Namen bearbeiten',
    storyBar: 'Geschichte',
  },

  close: 'Schließen',
  noWebGL: {
    heading: 'Dieses Stück braucht WebGL',
    body: 'Dein Browser oder Gerät scheint WebGL nicht zu unterstützen, das diese interaktive 3D-Szene braucht. Probier eine aktuelle Version von Chrome, Firefox, Safari oder Edge mit aktivierter Hardwarebeschleunigung.',
  },
};
