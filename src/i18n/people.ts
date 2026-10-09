/**
 * Names, pronouns and language: validation (pure, tested) and where they come
 * from on load. Precedence: query string, then localStorage, then defaults
 * (the browser language for the first visit). Only changes the user makes are
 * written back; a lecturer's prepared link doesn't overwrite a student's own names.
 *
 *   ?lang=de&istp=Anna&istpPronoun=she&other=Jonas&otherPronoun=he
 */
import { LANGS, PRONOUNS, type Lang, type People, type Person, type Pronoun } from './types';

export const MAX_NAME = 24;

export const DEFAULT_PEOPLE: People = {
  istp: { name: 'Phillip', pronoun: 'he' },
  other: { name: 'Lucie', pronoun: 'she' },
};

const KEY_LANG = 'istp-ballpoint.lang';
const KEY_PEOPLE = 'istp-ballpoint.people';

// Control characters, bidi overrides and zero-width spaces (not ZWJ/ZWNJ, which some scripts need);
// braces too, so a name can never become a template token.
const STRIP = /[\p{Cc}؜​‎‏‪-‮⁦-⁩﻿{}]/gu;

/** Trim, collapse whitespace, strip control characters, cap at MAX_NAME; empty → fallback. */
export function cleanName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const flat = raw.replace(/\s+/g, ' ').replace(STRIP, '').trim();
  const capped = Array.from(flat).slice(0, MAX_NAME).join('').trim();
  return capped || fallback;
}

export function cleanPronoun(raw: unknown, fallback: Pronoun): Pronoun {
  return PRONOUNS.includes(raw as Pronoun) ? (raw as Pronoun) : fallback;
}

export function cleanLang(raw: unknown): Lang | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 2) : '';
  return LANGS.includes(s as Lang) ? (s as Lang) : null;
}

function cleanPerson(raw: Partial<Record<keyof Person, unknown>> | undefined, def: Person): Person {
  return { name: cleanName(raw?.name, def.name), pronoun: cleanPronoun(raw?.pronoun, def.pronoun) };
}

export function cleanPeople(raw: unknown): People {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Partial<Record<keyof Person, unknown>> | undefined>;
  return { istp: cleanPerson(r.istp, DEFAULT_PEOPLE.istp), other: cleanPerson(r.other, DEFAULT_PEOPLE.other) };
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function read(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just won't survive a reload.
  }
}

export interface Prefs {
  lang: Lang;
  people: People;
}

/** Resolve the starting language and people from the URL, storage and browser. */
export function loadPrefs(search: string, storage: Storage | null, browserLang = ''): Prefs {
  const q = new URLSearchParams(search);
  let stored: unknown = null;
  try {
    stored = JSON.parse(read(storage, KEY_PEOPLE) ?? 'null');
  } catch {
    stored = null;
  }
  const base = cleanPeople(stored);
  const people: People = {
    istp: {
      name: cleanName(q.get('istp'), base.istp.name),
      pronoun: cleanPronoun(q.get('istpPronoun'), base.istp.pronoun),
    },
    other: {
      name: cleanName(q.get('other'), base.other.name),
      pronoun: cleanPronoun(q.get('otherPronoun'), base.other.pronoun),
    },
  };
  const lang = cleanLang(q.get('lang')) ?? cleanLang(read(storage, KEY_LANG)) ?? (cleanLang(browserLang) === 'de' ? 'de' : 'en');
  return { lang, people };
}

export function saveLang(storage: Storage | null, lang: Lang): void {
  write(storage, KEY_LANG, lang);
}

export function savePeople(storage: Storage | null, people: People): void {
  write(storage, KEY_PEOPLE, JSON.stringify(people));
}

/** localStorage, or null where touching it throws (sandboxed frames, some privacy modes). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
