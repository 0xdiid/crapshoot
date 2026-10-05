import { h } from './dom';
import { BOMB, NOTE, STOP_HAND, bitmap } from './icons';

type Kid = Node | string | null | undefined | false;

export interface WinOpts {
  cls?: string;
  palette?: boolean;
  onClose?: () => void;
}

/** A panel with a pinstriped header, the core of the game's retro look. */
export function win(title: string | Node, body: Kid[], opts: WinOpts = {}): HTMLElement {
  return h(
    'section.win',
    { class: [opts.palette ? 'win-palette' : '', opts.cls ?? ''] },
    h(
      'header.win-title',
      opts.onClose
        ? h('button.win-close', { onclick: opts.onClose, 'aria-label': 'Close', title: 'Close' })
        : h('span.win-close.inert'),
      h('span.win-name', title),
    ),
    h('div.win-body', ...(body.filter(Boolean) as Node[])),
  );
}

export type AlertIcon = 'stop' | 'note' | 'bomb' | Node;

export function alertIcon(kind: AlertIcon, size = 40): Node {
  if (kind === 'stop') return bitmap(STOP_HAND, size);
  if (kind === 'note') return bitmap(NOTE, size);
  if (kind === 'bomb') return bitmap(BOMB, size);
  return kind;
}

/** Alert layout: icon on the left, message on the right, buttons bottom-right. */
export function alertBody(icon: AlertIcon, title: string, text: Kid, buttons: Kid[] = []): HTMLElement {
  return h(
    'div.alert',
    h(
      'div.alert-main',
      h('div.alert-icon', alertIcon(icon)),
      h('div.alert-text', h('div.alert-title', title), text ?? null),
    ),
    buttons.length ? h('div.alert-buttons', ...(buttons.filter(Boolean) as Node[])) : null,
  );
}

/** The game's wordmark in the outline + drop-shadow style. */
export function logo(cls = ''): HTMLElement {
  return h('div.logo.mac-outline', { class: cls }, 'Crapshoot');
}

export interface Stat {
  label: string;
  value: string;
  cls?: string;
}

/** Full-width in-game header: wordmark, context stats, money and the menu button. */
export function topBar(stats: Stat[], right: Kid[]): HTMLElement {
  return h(
    'header.hud',
    logo('hud-logo'),
    h(
      'div.hud-stats',
      stats.map((s) => h('div.hud-stat', { class: s.cls ?? '' }, h('small', s.label), h('b', s.value))),
    ),
    h('div.hud-right', ...(right.filter(Boolean) as Node[])),
  );
}
