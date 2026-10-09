/**
 * Filling person-referring templates. Pure: no DOM, no globals.
 *
 * Tokens, resolved from the chosen names and pronouns:
 *   {istp} {other}                  the two names
 *   {he} {him} {his} {He} {His}     the ISTP's pronouns
 *   {she} {her} {hers} {She} {Her}  the companion's pronouns
 *   {istpGen} {otherGen}            the names in the genitive (German captions use
 *                                   these instead of possessive pronouns)
 *
 * English: he/him/his, she/her/her(s), they/them/their. Verb agreement for
 * "they" is the copy's job: a pronoun subject only takes past tense or a modal.
 * German: {he}/{she} are nominative (er, sie), {him}/{her} dative (ihm, ihr);
 * "they" falls back to the name.
 */
import type { Lang, People, Person, Pronoun } from './types';

export type Vars = Readonly<Record<string, string>>;

const TOKEN = /\{([A-Za-z]+)\}/g;

/** Fill `{token}`s from `vars`. Unknown tokens are left as they are; nothing is escaped. */
export function t(template: string, vars: Vars): string {
  return template.replace(TOKEN, (match, key: string) => (Object.hasOwn(vars, key) ? vars[key] : match));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** German genitive of a name: "Phillips", "Lucies", but "Felix’", "Jonas’", "Fritz’". */
export function gen(name: string): string {
  if (!name) return name;
  return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`;
}

/** English possessive: "Phillip’s". */
const possessive = (name: string) => `${name}’s`;

interface Forms {
  /** Subject. */
  nom: string;
  /** Object (English) or dative (German). */
  obj: string;
  /** Possessive determiner ("his book"). */
  poss: string;
  /** Possessive pronoun ("the book is hers"). */
  own: string;
}

const EN: Record<Pronoun, Forms> = {
  he: { nom: 'he', obj: 'him', poss: 'his', own: 'his' },
  she: { nom: 'she', obj: 'her', poss: 'her', own: 'hers' },
  they: { nom: 'they', obj: 'them', poss: 'their', own: 'theirs' },
};

function forms(lang: Lang, p: Person): Forms {
  if (lang === 'en') return EN[p.pronoun];
  // German: no possessive pronouns in the copy; the genitive name stands in for them.
  const g = gen(p.name);
  if (p.pronoun === 'he') return { nom: 'er', obj: 'ihm', poss: g, own: g };
  if (p.pronoun === 'she') return { nom: 'sie', obj: 'ihr', poss: g, own: g };
  return { nom: p.name, obj: p.name, poss: g, own: g };
}

/** The token table for one language and one pair of people. */
export function varsFor(lang: Lang, people: People): Vars {
  const a = forms(lang, people.istp);
  const b = forms(lang, people.other);
  const genitive = lang === 'de' ? gen : possessive;
  return {
    istp: people.istp.name,
    other: people.other.name,
    istpGen: genitive(people.istp.name),
    otherGen: genitive(people.other.name),
    he: a.nom,
    him: a.obj,
    his: a.poss,
    He: cap(a.nom),
    His: cap(a.poss),
    she: b.nom,
    her: b.obj,
    hers: b.own,
    She: cap(b.nom),
    Her: cap(b.obj),
  };
}

/**
 * Deep-fill a strings object: every string is filled, every function's result
 * is filled. Same shape out as in.
 */
export function fillAll<T>(value: T, vars: Vars): T {
  if (typeof value === 'string') return t(value, vars) as T;
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      const out = fn(...args);
      return typeof out === 'string' ? t(out, vars) : out;
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => fillAll(v, vars)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = fillAll(v, vars);
    return out as T;
  }
  return value;
}
