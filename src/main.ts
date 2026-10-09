import './styles.css';
import { App } from './app';
import { S } from './strings';

function webglAvailable(): boolean {
  // `?nowebgl` forces the fallback so it can be checked on any machine.
  if (new URLSearchParams(location.search).has('nowebgl')) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fallback(root: HTMLElement): void {
  const box = document.createElement('div');
  box.className = 'fallback';
  const h = document.createElement('h1');
  h.textContent = S.noWebGL.heading;
  const p = document.createElement('p');
  p.textContent = S.noWebGL.body;
  box.append(h, p);
  root.append(box);
}

const root = document.getElementById('app')!;
if (!webglAvailable()) {
  fallback(root);
} else {
  try {
    const app = new App(root);
    app.start();
    if (import.meta.env.DEV) {
      (window as unknown as { __ballpoint: App }).__ballpoint = app;
      void import('./debug').then((m) => m.installDebug(app));
    }
  } catch (err) {
    console.error(err);
    root.replaceChildren();
    fallback(root);
  }
}
