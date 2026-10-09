/**
 * Dev-only console helpers for exercising states without rAF (e.g. when the tab
 * is hidden). Not included in production builds.
 *
 *   __T(ti, se, ni, kind?, drawFor?)  set conditions, wait, fire a prompt, draw
 *   __V(id)                           fly the camera to an instrument (no card)
 *   __NT()                            disable CSS transitions (they freeze in hidden tabs)
 */
import type { App } from './app';
import type { InstrumentId, PromptKind } from './strings';

export function installDebug(app: App): void {
  const w = window as unknown as Record<string, unknown>;
  w.__T = (ti: boolean, se: boolean, ni: boolean, kind: PromptKind = 'okay', drawFor = 2.4) => {
    app.reset();
    app.setMode('sandbox');
    app.setLabels(false);
    if (ti) app.setLock(true);
    app.setFeed(se);
    app.setCompile(ni);
    app.step(4);
    app.prompt(kind);
    app.step(2.6 + drawFor);
    const b = app.store.beam;
    return { out: b.output, C: +b.C.toFixed(2), E: +b.E.toFixed(2), F: +b.F.toFixed(2), phase: app.store.prompt.phase };
  };
  w.__NT = () => {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(st);
  };
  w.__V = (id: InstrumentId) => {
    app.focus(id);
    app.step(1.5);
    app.store.ui.focus = null;
    document.querySelector('.card')?.classList.remove('open');
    app.step(1 / 60);
  };
}
