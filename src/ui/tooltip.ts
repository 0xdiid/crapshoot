import { h } from './dom';

let tipEl: HTMLElement | null = null;
let current: Element | null = null;
const hoverCapable = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;

function ensure(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div.tooltip', { role: 'tooltip' });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function showTip(anchor: Element, content: Node) {
  const t = ensure();
  current = anchor;
  t.replaceChildren(content);
  t.classList.add('show');
  const r = anchor.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 14;
  let below = false;
  if (y < 30) {
    y = r.bottom + 14;
    below = true;
  }
  x = Math.max(8, Math.min(innerWidth - tw - 8, x));
  y = Math.max(8, Math.min(innerHeight - th - 8, y));
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  t.style.setProperty('--tail', `${Math.max(14, Math.min(tw - 14, r.left + r.width / 2 - x))}px`);
  t.classList.toggle('below', below);
}

export function hideTip(anchor?: Element) {
  if (anchor && anchor !== current) return;
  tipEl?.classList.remove('show');
  current = null;
}

/** Hover tooltip on desktop, long-press on touch. */
export function tip(el: HTMLElement, content: () => Node | null): HTMLElement {
  if (hoverCapable) {
    el.addEventListener('mouseenter', () => {
      const c = content();
      if (c) showTip(el, c);
    });
    el.addEventListener('mouseleave', () => hideTip(el));
  }
  let timer: number | undefined;
  el.addEventListener(
    'touchstart',
    () => {
      timer = window.setTimeout(() => {
        const c = content();
        if (c) showTip(el, c);
      }, 380);
    },
    { passive: true },
  );
  const end = () => {
    clearTimeout(timer);
    setTimeout(() => hideTip(el), 1400);
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('click', () => hideTip(el));
  return el;
}

export function refreshTip(el: Element, content: Node) {
  if (current === el) showTip(el, content);
}

export function isHoverDevice() {
  return hoverCapable;
}
