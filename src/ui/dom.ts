type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & {
  class?: string | Record<string, boolean> | (string | false | null | undefined)[];
  style?: string | Partial<CSSStyleDeclaration> | Record<string, string>;
};

function addChildren(el: Element, kids: Child[]) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) addChildren(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export function cls(c: Attrs['class']): string {
  if (!c) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter(Boolean).join(' ');
  return Object.entries(c)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(' ');
}

/** Hyperscript: h('div.card#id', {onclick}, children) */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}${string}`,
  attrs?: Attrs | Child,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const m = /^([a-z0-9-]+)([^]*)$/i.exec(tag)!;
  const el = document.createElement(m[1]) as HTMLElementTagNameMap[K];
  const rest = m[2];
  for (const part of rest.match(/[.#][^.#]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs as Child);
  } else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') {
        const c = cls(v as Attrs['class']);
        if (c) el.className = (el.className ? el.className + ' ' : '') + c;
      } else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else
          for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else (el.style as unknown as Record<string, string>)[sk] = sv;
          }
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2), v as EventListener);
      } else if (k === 'html') {
        el.innerHTML = String(v);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  addChildren(el, children);
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(el: Element, ...children: Child[]): void {
  clear(el);
  addChildren(el, children);
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) >= 1e11) return n.toExponential(2).replace('+', '');
  return Math.floor(n).toLocaleString('en-US');
}

export function fmtShort(n: number): string {
  const trim = (v: number, d: number) => v.toFixed(d).replace(/\.0$/, '');
  if (n >= 1e12) return n.toExponential(1).replace('+', '');
  if (n >= 1e9) return trim(n / 1e9, n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return trim(n / 1e6, n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return trim(n / 1e3, n >= 1e5 ? 0 : 1) + 'K';
  return fmt(n);
}

export function fmtMult(n: number): string {
  if (n >= 1000) return fmt(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

export function pct(p: number): string {
  if (p <= 0) return '0%';
  if (p < 0.01) return '<1%';
  if (p > 0.99 && p < 1) return '>99%';
  return Math.round(p * 100) + '%';
}

/** Restart a CSS animation class on an element. */
export function pulse(el: Element | null | undefined, className: string): void {
  if (!el) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

export function rect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

export function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
