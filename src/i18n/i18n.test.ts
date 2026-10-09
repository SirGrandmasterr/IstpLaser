import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { fillAll, gen, t, varsFor } from './format';
import { cleanName, DEFAULT_PEOPLE, loadPrefs, MAX_NAME } from './people';
import { PRONOUNS, type People, type Pronoun, type Strings } from './types';

const people = (a: Pronoun, b: Pronoun, istp = 'Phillip', other = 'Lucie'): People => ({
  istp: { name: istp, pronoun: a },
  other: { name: other, pronoun: b },
});

describe('t()', () => {
  const vars = varsFor('en', DEFAULT_PEOPLE);

  it('fills names and pronouns, capitalised where asked', () => {
    expect(t('{istp} and {other}', vars)).toBe('Phillip and Lucie');
    expect(t('{He} told {her}; {she} thanked {him} for {his} time', vars)).toBe('He told her; she thanked him for his time');
    expect(t('{She} knew it was {hers}.', vars)).toBe('She knew it was hers.');
  });

  it('leaves unknown or malformed tokens alone and never throws', () => {
    expect(t('{prompt} {nope} { he } {} {', vars)).toBe('{prompt} {nope} { he } {} {');
    expect(t('{toString} {constructor}', vars)).toBe('{toString} {constructor}');
  });

  it('“they” in English, for either person', () => {
    const v = varsFor('en', people('they', 'they'));
    expect(t('{He} saw {him}, {his}: {she} {her} {hers} {She}', v)).toBe('They saw them, their: they them theirs They');
  });

  it('German: nominative and dative from the chosen set, the name for “they”, the genitive for possessives', () => {
    expect(t('{he}/{him} {she}/{her}', varsFor('de', people('he', 'she')))).toBe('er/ihm sie/ihr');
    expect(t('{he}/{him} {she}/{her}', varsFor('de', people('she', 'he')))).toBe('sie/ihr er/ihm');
    const v = varsFor('de', people('they', 'they', 'Anna', 'Jonas'));
    expect(t('{He} {him} {she} {her}', v)).toBe('Anna Anna Jonas Jonas');
    expect(t('{istpGen} Bild, {otherGen} Satz, {his} Ring', v)).toBe('Annas Bild, Jonas’ Satz, Annas Ring');
  });

  it('a name that looks like a token is not filled again', () => {
    expect(t('{istp}', { istp: '{other}', other: 'x' })).toBe('{other}');
  });
});

describe('gen()', () => {
  it('adds -s, or an apostrophe after s, ß, x and z', () => {
    expect(gen('Phillip')).toBe('Phillips');
    expect(gen('Lucie')).toBe('Lucies');
    expect(gen('Felix')).toBe('Felix’');
    expect(gen('Jonas')).toBe('Jonas’');
    expect(gen('Fritz')).toBe('Fritz’');
    expect(gen('Strauß')).toBe('Strauß’');
    expect(gen('MAX')).toBe('MAX’');
  });
});

describe('name validation', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanName('  Anna \n  Lena\t', 'x')).toBe('Anna Lena');
  });

  it('strips control and bidi characters, and braces', () => {
    expect(cleanName('An\u0007na‮', 'x')).toBe('Anna');
    expect(cleanName('{other}', 'x')).toBe('other');
  });

  it('caps the length in characters, not code units', () => {
    expect(cleanName('a'.repeat(40), 'x')).toHaveLength(MAX_NAME);
    expect(Array.from(cleanName('😀'.repeat(30), 'x'))).toHaveLength(MAX_NAME);
  });

  it('falls back to the default when empty', () => {
    expect(cleanName('', 'Phillip')).toBe('Phillip');
    expect(cleanName('  \u0000 ', 'Lucie')).toBe('Lucie');
    expect(cleanName(undefined, 'Lucie')).toBe('Lucie');
  });
});

describe('loadPrefs()', () => {
  const storage = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null, setItem: () => {} });

  it('defaults: Phillip (he) and Lucie (she), language from the browser', () => {
    expect(loadPrefs('', null, 'de-AT')).toEqual({ lang: 'de', people: DEFAULT_PEOPLE });
    expect(loadPrefs('', null, 'fr')).toEqual({ lang: 'en', people: DEFAULT_PEOPLE });
  });

  it('the query string beats storage, which beats defaults; bad values fall through', () => {
    const stored = storage({
      'istp-ballpoint.lang': 'en',
      'istp-ballpoint.people': JSON.stringify(people('she', 'they', 'Kim', 'Sam')),
    });
    expect(loadPrefs('', stored, 'de')).toEqual({ lang: 'en', people: people('she', 'they', 'Kim', 'Sam') });
    expect(loadPrefs('?lang=de&istp=Anna&other=Jonas&otherPronoun=he&istpPronoun=xx', stored)).toEqual({
      lang: 'de',
      people: people('she', 'he', 'Anna', 'Jonas'),
    });
    expect(loadPrefs('?lang=klingon&istp=%20', null, 'en').people.istp.name).toBe('Phillip');
  });

  it('survives storage that throws or holds junk', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(loadPrefs('', broken, 'en')).toEqual({ lang: 'en', people: DEFAULT_PEOPLE });
    expect(loadPrefs('', storage({ 'istp-ballpoint.people': '{nope' }), 'en').people).toEqual(DEFAULT_PEOPLE);
  });
});

describe('language files', () => {
  /** Every leaf: path → string (functions are called with a sample number). */
  function leaves(v: unknown, path = ''): [string, string][] {
    if (typeof v === 'string') return [[path, v]];
    if (typeof v === 'function') return [[path, String((v as (n: number) => unknown)(42))]];
    if (Array.isArray(v)) {
      expect(v.length, `${path} is empty`).toBeGreaterThan(0);
      return v.flatMap((x, i) => leaves(x, `${path}[${i}]`));
    }
    return Object.entries(v as object).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k));
  }

  it('both satisfy Strings, with the same keys and no empty strings', () => {
    const files: Strings[] = [en, de];
    const [a, b] = files.map((f) => leaves(f));
    expect(b.map(([p]) => p).filter((p) => !p.startsWith('keys.list'))).toEqual(a.map(([p]) => p).filter((p) => !p.startsWith('keys.list')));
    for (const [path, text] of [...a, ...b]) expect(text.trim(), path).not.toBe('');
  });

  it('every token resolves, for every language and pronoun choice', () => {
    for (const [lang, file] of [['en', en], ['de', de]] as const) {
      for (const p of PRONOUNS) {
        for (const q of PRONOUNS) {
          const filled = fillAll(file, varsFor(lang, people(p, q)));
          for (const [path, text] of leaves(filled)) {
            const left = text.replace('{prompt}', '').match(/\{[A-Za-z]+\}/);
            expect(left, `${lang} ${p}/${q} ${path}`).toBeNull();
          }
        }
      }
    }
  });
});
