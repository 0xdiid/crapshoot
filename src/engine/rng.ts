// Seeded PRNG (mulberry32). State lives on the run so saves are deterministic.
export interface RngHolder {
  rng: number;
}

export function nextFloat(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(h: RngHolder, n: number): number {
  return Math.floor(nextFloat(h) * n);
}

export function chance(h: RngHolder, p: number): boolean {
  return nextFloat(h) < p;
}

export function pick<T>(h: RngHolder, arr: readonly T[]): T {
  return arr[randInt(h, arr.length)];
}

export function weightedPick<T>(h: RngHolder, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = nextFloat(h) * total;
  for (const t of items) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return items[items.length - 1];
}

export function shuffle<T>(h: RngHolder, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(h, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function randomSeedString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
