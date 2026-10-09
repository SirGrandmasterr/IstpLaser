/** Small DOM helpers, and text bindings that follow the language and the names. */
import { S, type Strings } from '../strings';

export const SVG = 'http://www.w3.org/2000/svg';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export type Get = (s: Strings) => string;

/**
 * Every piece of text that comes from the strings registers here once, as a
 * getter; `render()` re-reads them all (language switch, new names). Text
 * always goes to `textContent` or an attribute, never to HTML.
 */
export class Texts {
  private list: (() => void)[] = [];

  /** Bind an element's text. */
  text<E extends HTMLElement>(e: E, get: Get): E {
    this.add(() => {
      const v = get(S());
      if (e.textContent !== v) e.textContent = v;
    });
    return e;
  }

  /** Bind an attribute (aria-label, title, placeholder…). */
  attr<E extends Element>(e: E, name: string, get: Get): E {
    this.add(() => e.setAttribute(name, get(S())));
    return e;
  }

  /** Any other re-render, run now and on every change. */
  add(fn: () => void): void {
    this.list.push(fn);
    fn();
  }

  render(): void {
    for (const fn of this.list) fn();
  }
}

export function kbd(key: string): HTMLElement {
  const e = el('kbd', '', key);
  e.setAttribute('aria-hidden', 'true');
  return e;
}
