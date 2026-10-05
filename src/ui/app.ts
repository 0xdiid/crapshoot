import { GameError, newRun, type RunState } from '../engine';
import { sfx, setVolumes, unlockAudio } from './audio';
import { setMusicIntensity, setMusicScene, startMusic, type Scene } from './music';
import { h, mount } from './dom';
import { fxSettings, zoomRects } from './fx';
import { hideTip } from './tooltip';
import { loadRun, meta, saveMeta, saveRun, saveSettings, settings } from './store';

export type MenuScreen = 'title' | 'setup' | 'howto';

export interface ScreenView {
  el: HTMLElement;
  update?(): void;
  destroy?(): void;
}

type ScreenFactory = (app: App) => ScreenView;

export class App {
  root: HTMLElement;
  run: RunState | null = null;
  view: ScreenView | null = null;
  viewKey = '';
  busy = false;
  /** Set by the table screen: lets a trick target a thrown die. */
  pickThrown?: (prompt: string, why: (id: string) => string | null) => Promise<string | null>;
  afterTrick?: (id: string, dieId?: string) => void;
  private listeners: (() => void)[] = [];
  private overlay: HTMLElement;
  private toasts: HTMLElement;
  private screens: Record<string, ScreenFactory> = {};
  private modalStack: HTMLElement[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.overlay = h('div.overlay-root');
    this.toasts = h('div.toasts');
    document.body.append(this.overlay, this.toasts);
    this.applySettings();
    const unlock = () => {
      unlockAudio();
      startMusic();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  onChange(f: () => void) {
    this.listeners.push(f);
  }

  notify() {
    for (const f of this.listeners) f();
    document.body.classList.toggle('busy', this.busy);
  }

  register(key: string, f: ScreenFactory) {
    this.screens[key] = f;
  }

  applySettings() {
    setVolumes(settings.sfx, settings.music);
    fxSettings.shake = settings.shake;
    fxSettings.reduced = settings.reduced;
    document.documentElement.style.setProperty('--speed', String(1 / settings.speed));
    document.documentElement.classList.toggle('reduced', settings.reduced);
    saveSettings();
  }

  /** Delay helper scaled by the animation speed setting. */
  ms(n: number) {
    return settings.reduced ? n * 0.4 : n / settings.speed;
  }

  // ---------- Navigation ----------

  go(key: string) {
    hideTip();
    this.closeAllModals();
    this.view?.destroy?.();
    this.pickThrown = undefined;
    this.afterTrick = undefined;
    const f = this.screens[key];
    this.view = f(this);
    this.viewKey = key;
    setMusicScene(this.sceneFor(key));
    mount(this.root, this.view.el);
    this.root.scrollTop = 0;
    this.notify();
    requestAnimationFrame(() => {
      const w = this.root.querySelector('.win:not(.win-palette)');
      if (w) zoomRects(w.getBoundingClientRect());
    });
  }

  sceneFor(key: string): Scene {
    if (key === 'table') return this.run?.table?.kind === 'boss' ? 'boss' : 'table';
    if (key === 'board' || key === 'shop') return 'backroom';
    return 'lobby';
  }

  /** Route to the screen matching the run's phase. */
  sync() {
    const run = this.run;
    if (!run) return this.go('title');
    const key =
      run.phase === 'select'
        ? 'board'
        : run.phase === 'table' || run.phase === 'payout'
          ? 'table'
          : run.phase === 'shop'
            ? 'shop'
            : 'end';
    if (this.viewKey === key && this.view?.update) this.view.update();
    else this.go(key);
    setMusicIntensity(run.phase === 'table' && run.table ? Math.min(1, run.table.score / run.table.target) : 0);
  }

  startRun(profileId: string, stake: number, seed?: string) {
    this.run = newRun({ profileId, stake, seed: seed || undefined });
    meta.runs += 1;
    saveMeta();
    this.save();
    this.sync();
  }

  continueRun() {
    const r = loadRun();
    if (!r) return;
    this.run = r;
    this.sync();
  }

  quitToTitle() {
    this.save();
    this.run = null;
    this.go('title');
  }

  save() {
    saveRun(this.run);
    this.notify();
  }

  /** Run an engine action; game errors become a toast instead of an exception. */
  act<T>(fn: () => T, opts: { quiet?: boolean } = {}): T | undefined {
    try {
      const r = fn();
      this.save();
      return r;
    } catch (e) {
      if (e instanceof GameError) {
        if (!opts.quiet) this.toast(e.message, 'bad');
        sfx.deny();
        return undefined;
      }
      throw e;
    }
  }

  /** Like act, but reports success as a boolean (for actions that return nothing). */
  ok(fn: () => unknown, opts: { quiet?: boolean } = {}): boolean {
    let done = false;
    this.act(() => {
      fn();
      done = true;
    }, opts);
    return done;
  }

  recordEnd(won: boolean) {
    const run = this.run;
    if (!run) return;
    meta.bestAnte = Math.max(meta.bestAnte, run.ante);
    meta.bestRoll = Math.max(meta.bestRoll, run.stats.bestThrow);
    if (won) {
      meta.wins += 1;
      meta.profileWins[run.profileId] = (meta.profileWins[run.profileId] ?? 0) + 1;
      meta.stakeUnlocked = Math.max(meta.stakeUnlocked, Math.min(3, run.stake + 1));
    }
    saveMeta();
  }

  // ---------- Overlays ----------

  toast(msg: string, kind: 'info' | 'bad' | 'good' = 'info') {
    const t = h('div.toast', { class: `toast-${kind}` }, msg);
    this.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2600);
  }

  modal(content: HTMLElement, opts: { dismissable?: boolean; cls?: string; onClose?: () => void } = {}): () => void {
    hideTip();
    this.clearHints();
    const close = () => {
      if (!wrap.isConnected) return;
      wrap.classList.add('closing');
      this.modalStack = this.modalStack.filter((m) => m !== wrap);
      setTimeout(() => wrap.remove(), 180);
      opts.onClose?.();
    };
    const wrap = h(
      'div.modal-wrap',
      {
        class: opts.cls,
        onclick: (e: MouseEvent) => {
          if (e.target === wrap && opts.dismissable !== false) close();
        },
      },
      h('div.modal', content),
    );
    (wrap as HTMLElement & { close?: () => void }).close = close;
    this.overlay.appendChild(wrap);
    this.modalStack.push(wrap);
    requestAnimationFrame(() => {
      const m = wrap.querySelector('.modal');
      if (m) zoomRects(m.getBoundingClientRect());
    });
    return close;
  }

  closeTopModal(): boolean {
    const top = this.modalStack[this.modalStack.length - 1] as (HTMLElement & { close?: () => void }) | undefined;
    if (!top) return false;
    top.close?.();
    return true;
  }

  closeAllModals() {
    for (const m of [...this.modalStack]) (m as HTMLElement & { close?: () => void }).close?.();
  }

  hasModal() {
    return this.modalStack.length > 0;
  }

  confirm(title: string, body: string, yes = 'Yes', no = 'Cancel'): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;
      const done = (v: boolean) => {
        if (answered) return;
        answered = true;
        close();
        resolve(v);
      };
      const close = this.modal(
        h(
          'div.confirm',
          h('h2', title),
          h('p', body),
          h(
            'div.row',
            h('button.btn', { onclick: () => done(false) }, no),
            h('button.btn.btn-primary', { onclick: () => done(true) }, yes),
          ),
        ),
        { onClose: () => done(false) },
      );
    });
  }

  // ---------- Coach marks ----------

  hint(id: string, anchor: Element | null, text: string, place: 'top' | 'bottom' = 'top') {
    if (!settings.hints || !anchor || meta.seenHints.includes(id) || this.hasModal()) return;
    if (document.querySelector(`.hint[data-id="${id}"]`)) return;
    const el = h(
      'div.hint',
      { 'data-id': id, class: `hint-${place}` },
      h('div.hint-text', text),
      h('button.hint-ok', { onclick: () => this.dismissHint(id) }, 'Got it'),
    );
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(280, innerWidth - 24);
    el.style.width = `${w}px`;
    const x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    el.style.left = `${x}px`;
    el.style.setProperty('--arrow', `${r.left + r.width / 2 - x}px`);
    if (place === 'top') el.style.top = `${r.top - el.offsetHeight - 14}px`;
    else el.style.top = `${r.bottom + 14}px`;
  }

  dismissHint(id: string) {
    document.querySelector(`.hint[data-id="${id}"]`)?.remove();
    if (!meta.seenHints.includes(id)) {
      meta.seenHints.push(id);
      saveMeta();
    }
  }

  clearHints() {
    document.querySelectorAll('.hint').forEach((e) => e.remove());
  }
}
