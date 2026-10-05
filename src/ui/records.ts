import type { App } from './app';
import { sfx } from './audio';
import { openDiceBox } from './dicebox';
import { h } from './dom';
import { px } from './icons';
import { openPaytable } from './menus';
import { meta } from './store';

/** Lifetime stats, shown as bar gauges. */
export function openRecords(app: App) {
  const bar = (label: string, value: number, max: number, text: string) =>
    h(
      'div.about-row',
      h('span.about-label', label),
      h('div.about-bar', h('div.about-fill', { style: { width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` } })),
      h('span.about-val', text),
    );
  let close = () => {};
  close = app.modal(
    h(
      'div.about',
      h('div.about-head', px('🏆', 48, 24), h('div', h('div.about-name', 'Records'), h('div.muted', 'Every run you have played'))),
      h(
        'div.about-rows',
        bar('Runs played', meta.runs, Math.max(10, meta.runs), String(meta.runs)),
        bar('Runs won', meta.wins, Math.max(1, meta.runs), String(meta.wins)),
        bar('Best ante', meta.bestAnte, 8, `${meta.bestAnte} of 8`),
        bar('Best throw', meta.bestRoll, Math.max(1, meta.bestRoll), meta.bestRoll.toLocaleString()),
      ),
      h('div.alert-buttons', h('button.btn.btn-primary', { onclick: () => close() }, 'OK')),
    ),
  );
}

/** D opens the Dice Box between tables, P the hands table. */
export function installShortcuts(app: App) {
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || app.hasModal()) return;
    const k = e.key.toLowerCase();
    if (k === 'd' && app.run && (app.run.phase === 'select' || app.run.phase === 'shop')) {
      sfx.click();
      openDiceBox(app, () => app.view?.update?.());
    } else if (k === 'p' && app.run) {
      sfx.click();
      openPaytable(app);
    }
  });
}
