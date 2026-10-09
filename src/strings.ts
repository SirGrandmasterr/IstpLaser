/**
 * The active language, with the chosen names and pronouns already filled in.
 * The copy itself lives in src/i18n/en.ts and src/i18n/de.ts.
 *
 * `S()` is cheap: the filled-in strings are rebuilt only when the language or
 * the people change. Anything holding text should re-read it on the bus's
 * `text` event.
 */
import { de } from './i18n/de';
import { en } from './i18n/en';
import { fillAll, varsFor } from './i18n/format';
import { DEFAULT_PEOPLE } from './i18n/people';
import type { Lang, People, Strings } from './i18n/types';

export type { InstrumentId, Lang, People, Pronoun, PromptKind, Strings } from './i18n/types';

const SOURCES: Record<Lang, Strings> = { en, de };

let lang: Lang = 'en';
let people: People = DEFAULT_PEOPLE;
let active: Strings = fillAll(en, varsFor('en', people));

/** The active strings. */
export function S(): Strings {
  return active;
}

export function currentLang(): Lang {
  return lang;
}

export function currentPeople(): People {
  return people;
}

/** Switch language and/or people; returns whether anything changed. */
export function configure(next: { lang?: Lang; people?: People }): boolean {
  const l = next.lang ?? lang;
  const p = next.people ?? people;
  const same =
    l === lang &&
    p.istp.name === people.istp.name &&
    p.istp.pronoun === people.istp.pronoun &&
    p.other.name === people.other.name &&
    p.other.pronoun === people.other.pronoun;
  if (same) return false;
  lang = l;
  people = { istp: { ...p.istp }, other: { ...p.other } };
  active = fillAll(SOURCES[lang], varsFor(lang, people));
  syncDocument();
  return true;
}

/** `<html lang>` and the page title follow the language. */
export function syncDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = `${active.title} · ${active.subtitle}`;
}
