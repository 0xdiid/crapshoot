// Particles, floating text and screen shake.

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'coin' | 'chip' | 'spark' | 'confetti' | 'smoke' | 'shard' | 'star';
  rot: number;
  vr: number;
  g: number;
  drag: number;
  target?: { x: number; y: number };
  onArrive?: () => void;
}

const parts: P[] = [];
let canvas: HTMLCanvasElement;
let g: CanvasRenderingContext2D;
let running = false;
let dpr = 1;
export const fxSettings = { shake: true, reduced: false };

export function initFx() {
  canvas = document.getElementById('fx') as HTMLCanvasElement;
  g = canvas.getContext('2d')!;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
}

function loop() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= 1;
    if (p.target) {
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      const age = p.max - p.life;
      const pull = Math.min(1, age / 18) * 2.2;
      p.vx += (dx / (d || 1)) * pull;
      p.vy += (dy / (d || 1)) * pull;
      p.vx *= 0.88;
      p.vy *= 0.88;
      if (d < 18 && age > 8) {
        p.onArrive?.();
        parts.splice(i, 1);
        continue;
      }
    } else {
      p.vy += p.g;
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.life <= 0) {
      if (p.target) p.onArrive?.();
      parts.splice(i, 1);
      continue;
    }
    // Pixel look: everything snaps to a 2px grid and draws as squares.
    const q = 2;
    const x = Math.round(p.x / q) * q;
    const y = Math.round(p.y / q) * q;
    const sz = Math.max(q, Math.round(p.size / q) * q);
    const fade = p.life < p.max * 0.25 && (p.life & 2) === 0;
    if (fade) continue;
    switch (p.kind) {
      case 'coin': {
        const w = Math.abs(Math.cos(p.rot * 3)) > 0.4 ? sz : Math.max(q, sz / 3);
        g.fillStyle = '#000';
        g.fillRect(x - w / 2 - q, y - sz / 2 - q, w + 2 * q, sz + 2 * q);
        g.fillStyle = '#fcf305';
        g.fillRect(x - w / 2, y - sz / 2, w, sz);
        break;
      }
      case 'chip':
        g.fillStyle = '#000';
        g.fillRect(x - sz / 2 - q, y - sz / 2 - q, sz + 2 * q, sz + 2 * q);
        g.fillStyle = p.color;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        g.fillStyle = '#fff';
        g.fillRect(x - q / 2, y - q / 2, q, q);
        break;
      case 'star':
        g.fillStyle = p.color;
        g.fillRect(x - sz / 2, y - q / 2, sz, q);
        g.fillRect(x - q / 2, y - sz / 2, q, sz);
        break;
      case 'smoke':
        g.fillStyle = '#888';
        g.fillRect(x, y, sz, sz);
        break;
      default:
        g.fillStyle = p.color;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }
  if (parts.length) requestAnimationFrame(loop);
  else {
    running = false;
    g.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function add(p: Partial<P> & { x: number; y: number; kind: P['kind'] }) {
  if (fxSettings.reduced && parts.length > 60) return;
  const life = p.life ?? 60;
  parts.push({
    vx: 0,
    vy: 0,
    size: 6,
    color: '#fff',
    rot: Math.random() * 6,
    vr: 0,
    g: 0.25,
    drag: 0.98,
    max: life,
    ...p,
    life,
  });
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const scale = (n: number) => (fxSettings.reduced ? Math.ceil(n / 4) : n);

export function burst(x: number, y: number, kind: P['kind'], n: number, colors: string[] = ['#fff'], power = 6) {
  for (let i = 0; i < scale(n); i++) {
    const a = rnd(0, Math.PI * 2);
    const s = rnd(power * 0.3, power);
    add({
      x,
      y,
      kind,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (kind === 'confetti' ? 4 : 1),
      size: kind === 'confetti' ? rnd(6, 11) : kind === 'spark' ? rnd(2, 5) : rnd(4, 8),
      color: colors[i % colors.length],
      life: rnd(40, 80),
      vr: rnd(-0.3, 0.3),
      g: kind === 'spark' ? -0.02 : kind === 'smoke' ? -0.05 : kind === 'confetti' ? 0.12 : 0.28,
      drag: kind === 'confetti' ? 0.97 : 0.96,
    });
  }
}

export function flames(x: number, y: number, w: number, n = 20) {
  for (let i = 0; i < scale(n); i++) {
    add({
      x: x + rnd(-w / 2, w / 2),
      y: y + rnd(-4, 4),
      kind: 'spark',
      vx: rnd(-0.5, 0.5),
      vy: rnd(-3, -1),
      size: rnd(3, 7),
      color: ['#ff6403', '#fcf305', '#dd0806', '#ff6403'][i % 4],
      life: rnd(25, 50),
      g: -0.05,
      drag: 0.97,
    });
  }
}

export function stream(
  from: { x: number; y: number },
  to: { x: number; y: number },
  kind: P['kind'],
  n: number,
  color = '#fff',
  onEach?: (i: number) => void,
) {
  for (let i = 0; i < scale(n); i++) {
    setTimeout(() => {
      const a = rnd(0, Math.PI * 2);
      add({
        x: from.x + rnd(-10, 10),
        y: from.y + rnd(-10, 10),
        kind,
        vx: Math.cos(a) * rnd(3, 8),
        vy: Math.sin(a) * rnd(3, 8),
        size: kind === 'coin' ? 7 : 6,
        color,
        life: 90,
        target: to,
        vr: 0.1,
        onArrive: onEach ? () => onEach(i) : undefined,
      });
    }, i * 28);
  }
}

export function confetti() {
  const colors = ['#dd0806', '#0000d4', '#fcf305', '#1fb714', '#f20884', '#ff6403', '#02abea'];
  for (let i = 0; i < scale(140); i++) {
    const left = i % 2 === 0;
    add({
      x: left ? -10 : innerWidth + 10,
      y: innerHeight * rnd(0.5, 0.9),
      kind: 'confetti',
      vx: (left ? 1 : -1) * rnd(6, 16),
      vy: rnd(-18, -8),
      size: rnd(7, 12),
      color: colors[i % colors.length],
      life: rnd(90, 150),
      vr: rnd(-0.3, 0.3),
      g: 0.3,
      drag: 0.975,
    });
  }
}

// ---------- Screen shake ----------

let shakeAmt = 0;
let shaking = false;
export function shake(amount: number) {
  if (!fxSettings.shake || fxSettings.reduced) return;
  shakeAmt = Math.max(shakeAmt, amount);
  if (shaking) return;
  shaking = true;
  const app = document.getElementById('app')!;
  const tick = () => {
    shakeAmt *= 0.86;
    if (shakeAmt < 0.4) {
      app.style.transform = '';
      shaking = false;
      return;
    }
    app.style.transform = `translate(${rnd(-1, 1) * shakeAmt}px, ${rnd(-1, 1) * shakeAmt}px) rotate(${rnd(-1, 1) * shakeAmt * 0.04}deg)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Floating text ----------

let layer: HTMLElement | null = null;
export function floatText(
  x: number,
  y: number,
  text: string,
  kind: 'chips' | 'mult' | 'xmult' | 'money' | 'note' | 'bad' | 'heat',
  big = false,
) {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'float-layer';
    document.body.appendChild(layer);
  }
  const el = document.createElement('div');
  el.className = `float float-${kind}${big ? ' float-big' : ''}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--dx', `${rnd(-18, 18)}px`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

/** Dotted zoom rectangles, from a point or rect out to a target rect. */
export function zoomRects(to: DOMRect, from?: DOMRect) {
  if (fxSettings.reduced) return;
  const src = from ?? new DOMRect(to.left + to.width / 2 - 8, to.top + to.height / 2 - 6, 16, 12);
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const r = document.createElement('div');
    r.className = 'zoom-rect';
    r.style.left = `${src.left + (to.left - src.left) * k}px`;
    r.style.top = `${src.top + (to.top - src.top) * k}px`;
    r.style.width = `${src.width + (to.width - src.width) * k}px`;
    r.style.height = `${src.height + (to.height - src.height) * k}px`;
    r.style.visibility = 'hidden';
    document.body.appendChild(r);
    setTimeout(() => (r.style.visibility = 'visible'), i * 22);
    setTimeout(() => r.remove(), i * 22 + 70);
  }
}
