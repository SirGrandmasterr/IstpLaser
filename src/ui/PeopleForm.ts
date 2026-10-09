/**
 * The two names with a pronoun choice each, and the EN · DE switch. Used on
 * the intro card and in the panel's View section. Changes apply as you type.
 */
import { cleanName, DEFAULT_PEOPLE } from '../i18n/people';
import { LANGS, PRONOUNS, type Lang, type People, type Pronoun } from '../i18n/types';
import { currentLang, currentPeople } from '../strings';
import { el, type Get, type Texts } from './dom';

type Who = 'istp' | 'other';

interface Row {
  input: HTMLInputElement;
  radios: Record<Pronoun, HTMLInputElement>;
}

export class PeopleForm {
  readonly root: HTMLElement;
  private rows = {} as Record<Who, Row>;

  constructor(texts: Texts, id: string, onChange: (people: People) => void) {
    this.root = el('div', 'people');
    const read = (): People => ({
      istp: { name: cleanName(this.rows.istp.input.value, DEFAULT_PEOPLE.istp.name), pronoun: this.pronoun('istp') },
      other: { name: cleanName(this.rows.other.input.value, DEFAULT_PEOPLE.other.name), pronoun: this.pronoun('other') },
    });
    const row = (who: Who, label: Get, legend: Get) => {
      const r = el('div', 'person');
      const inputId = `${id}-${who}`;
      const lab = texts.text(el('label', 'person-label'), label);
      lab.htmlFor = inputId;
      const input = el('input', 'person-name');
      input.id = inputId;
      input.type = 'text';
      input.maxLength = 24;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = DEFAULT_PEOPLE[who].name;
      input.addEventListener('input', () => onChange(read()));
      // Once the field is left, show the name as it is used (trimmed, capped; empty for the default).
      input.addEventListener('blur', () => this.show(who, currentPeople(), true));
      const set = el('fieldset', 'pronouns');
      const leg = texts.text(el('legend', 'sr-only'), legend);
      set.append(leg);
      const radios = {} as Record<Pronoun, HTMLInputElement>;
      for (const p of PRONOUNS) {
        const opt = el('label', 'pronoun');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = `${id}-${who}-pronoun`;
        radio.value = p;
        radio.addEventListener('change', () => onChange(read()));
        const span = texts.text(el('span'), (s) => s.pronouns[p].label);
        texts.attr(opt, 'title', (s) => s.pronouns[p].title);
        opt.append(radio, span);
        set.append(opt);
        radios[p] = radio;
      }
      r.append(lab, input, set);
      this.rows[who] = { input, radios };
      return r;
    };
    this.root.append(
      row('istp', (s) => s.intro.istp, (s) => s.intro.istpPronouns),
      row('other', (s) => s.intro.other, (s) => s.intro.otherPronouns),
    );
    this.set(currentPeople());
  }

  private pronoun(who: Who): Pronoun {
    return PRONOUNS.find((p) => this.rows[who].radios[p].checked) ?? DEFAULT_PEOPLE[who].pronoun;
  }

  /** Show these people. A field being typed in is left alone. */
  set(people: People): void {
    this.show('istp', people, false);
    this.show('other', people, false);
  }

  private show(who: Who, people: People, force: boolean): void {
    const r = this.rows[who];
    const name = people[who].name;
    // The default name stays a placeholder: an empty field visibly means "the default".
    const shown = name === DEFAULT_PEOPLE[who].name ? '' : name;
    if ((force || document.activeElement !== r.input) && r.input.value !== shown) r.input.value = shown;
    r.radios[people[who].pronoun].checked = true;
  }

  focus(): void {
    this.rows.istp.input.focus({ preventScroll: true });
  }
}

/** "EN · DE": two pressed-state buttons. */
export class LangSwitch {
  readonly root: HTMLElement;
  private buttons = {} as Record<Lang, HTMLButtonElement>;

  constructor(texts: Texts, onPick: (lang: Lang) => void) {
    this.root = el('div', 'lang-switch');
    this.root.setAttribute('role', 'group');
    texts.attr(this.root, 'aria-label', (s) => s.language.label);
    LANGS.forEach((lang, i) => {
      if (i > 0) {
        const dot = el('span', 'lang-dot', '·');
        dot.setAttribute('aria-hidden', 'true');
        this.root.append(dot);
      }
      const b = el('button', 'lang-btn', lang.toUpperCase());
      b.type = 'button';
      b.lang = lang;
      // Each language names itself, whatever the page is in.
      texts.attr(b, 'aria-label', (s) => s.language.names[lang]);
      b.addEventListener('click', () => onPick(lang));
      this.buttons[lang] = b;
      this.root.append(b);
    });
    texts.add(() => this.sync());
  }

  sync(): void {
    for (const lang of LANGS) this.buttons[lang].setAttribute('aria-pressed', String(lang === currentLang()));
  }
}
