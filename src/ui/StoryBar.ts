/**
 * The story bar: act and progress, the caption, a spoken line, and in Act III
 * the step to do, "Do it for {istp}" and a one-line acknowledgement. It is the
 * only live region while the story runs.
 */
import { S } from '../strings';
import type { StoryFrame } from '../story/Story';
import { el, type Texts } from './dom';

export class StoryBar {
  readonly root: HTMLElement;
  private label: HTMLElement;
  private dots: HTMLElement;
  private dotList: HTMLElement[] = [];
  private text: HTMLElement;
  private quote: HTMLElement;
  private task: HTMLElement;
  private hint: HTMLElement;
  private doIt: HTMLButtonElement;
  private frame: StoryFrame | null = null;

  constructor(texts: Texts, onSkip: () => void, onAssist: () => void) {
    this.root = el('div', 'story-bar');
    this.root.setAttribute('role', 'region');
    texts.attr(this.root, 'aria-label', (s) => s.a11y.storyBar);
    this.label = el('span', 'story-label');
    this.dots = el('div', 'story-dots');
    this.dots.setAttribute('aria-hidden', 'true');
    const skip = texts.text(el('button', 'btn ghost'), (s) => s.story.skip);
    skip.type = 'button';
    texts.attr(skip, 'aria-label', (s) => s.a11y.skip);
    skip.addEventListener('click', onSkip);
    const head = el('div', 'story-head');
    head.append(this.label, this.dots, skip);

    // Caption and line are what gets read out; the task row is announced once, when it appears.
    const live = el('div', 'story-live');
    live.setAttribute('aria-live', 'polite');
    this.text = el('p', 'story-text');
    this.quote = el('p', 'story-quote');
    live.append(this.text, this.quote);

    this.task = el('div', 'story-task');
    this.hint = el('p', 'story-hint');
    this.doIt = el('button', 'btn primary story-do');
    this.doIt.type = 'button';
    this.doIt.addEventListener('click', onAssist);
    this.task.append(this.hint, this.doIt);

    this.root.append(head, live, this.task);
    texts.add(() => this.render());
  }

  show(frame: StoryFrame): void {
    const taskWas = this.frame?.task?.kind ?? null;
    this.frame = frame;
    if (this.dotList.length !== frame.acts.length) this.buildDots(frame);
    this.render();
    // Announce the step when it opens (and the acknowledgement), not every re-render.
    this.task.setAttribute('aria-live', frame.task?.kind !== taskWas || frame.ack ? 'polite' : 'off');
  }

  private buildDots(frame: StoryFrame): void {
    this.dots.replaceChildren();
    this.dotList = frame.acts.map((act, i) => {
      const d = el('span', 'dot');
      if (i > 0 && frame.acts[i - 1] !== act) d.classList.add('act-start');
      this.dots.append(d);
      return d;
    });
  }

  private render(): void {
    const f = this.frame;
    if (!f) return;
    const s = S();
    this.label.textContent = s.story.acts[f.act - 1];
    this.dotList.forEach((d, i) => {
      d.classList.toggle('done', i < f.index);
      d.classList.toggle('now', i === f.index);
    });
    this.text.textContent = f.text ? f.text(s) : '';
    this.text.hidden = !f.text;
    this.quote.textContent = f.quote ? f.quote(s) : '';
    this.quote.hidden = !f.quote;
    const open = f.task !== null;
    this.task.hidden = !open && !f.ack;
    this.task.classList.toggle('ack', !open && f.ack);
    this.hint.textContent = open ? f.task!.hint(s) : f.ack ? s.story.byHand : '';
    this.doIt.hidden = !open;
    this.doIt.disabled = f.assisted;
    this.doIt.textContent = f.assisted ? s.story.doing : s.story.doIt;
  }
}
