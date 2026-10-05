import { FACE_SETS, MODS, WILD, type Die } from '../engine';
import { h } from './dom';
import { px } from './icons';

const PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function dieStyle(d: Die): Record<string, string> {
  const fs = FACE_SETS[d.faceSet];
  return { '--body': fs.body, '--pip': fs.pip };
}

export function matClass(d: Die): string {
  const mats = d.mods.map((m) => `m-${m}`);
  return [`fs-${d.faceSet}`, ...mats].join(' ');
}

/** The pip grid (or wild star) for a face value. */
export function pips(value: number): HTMLElement {
  if (value === WILD) return h('div.pips.wild', h('span.star', '★'));
  const on = PIPS[value] ?? [];
  return h(
    'div.pips',
    Array.from({ length: 9 }, (_, i) => h('i', { class: on.includes(i + 1) ? 'on' : '' })),
  );
}

export interface DieElOpts {
  face?: number;
  size?: number;
  badges?: boolean;
  onclick?: (e: MouseEvent) => void;
  cls?: string;
}

/** A flat die showing one face, with mod badges. */
export function dieEl(d: Die, opts: DieElOpts = {}): HTMLElement {
  const face = opts.face ?? (d.faces.includes(WILD) ? WILD : Math.max(...d.faces));
  const el = h(
    'div.die',
    {
      class: `${matClass(d)} ${opts.cls ?? ''}`,
      style: { ...dieStyle(d), '--s': `${opts.size ?? 56}px` },
      'data-uid': d.uid,
      onclick: opts.onclick,
    },
    h('div.die-face', pips(face)),
    opts.badges !== false && d.mods.length
      ? h(
          'div.die-badges',
          d.mods.map((m) => h('span.badge', { style: { '--c': MODS[m].color } }, px(MODS[m].icon, 16, 16))),
        )
      : null,
  );
  return el;
}

/** Small row of all six faces. */
export function faceStrip(d: Die, size = 22, standard = false): HTMLElement {
  const faces = standard ? [1, 2, 3, 4, 5, 6] : d.faces;
  return h(
    'div.face-strip',
    faces.map((f) =>
      h(
        'div.die.mini',
        { class: matClass(d), style: { ...dieStyle(d), '--s': `${size}px` } },
        h('div.die-face', pips(f)),
      ),
    ),
  );
}

// ---------- 3D cube ----------

const FACE_ROT: [number, number][] = [
  [0, 0],
  [0, 180],
  [0, -90],
  [0, 90],
  [-90, 0],
  [90, 0],
];

export interface Cube {
  el: HTMLElement;
  body: HTMLElement;
  faces: HTMLElement[];
  setFace(index: number, value: number): void;
  orient(index: number, spins: number, z: number): string;
}

export function cube(d: Die, size: number, standardFaces = false): Cube {
  const values = standardFaces ? [1, 2, 3, 4, 5, 6] : d.faces;
  const faces = values.map((v, i) => h(`div.cf.cf${i}`, pips(v)));
  const body = h('div.cube', faces);
  const el = h(
    'div.cube-wrap',
    { class: matClass(d), style: { ...dieStyle(d), '--s': `${size}px` }, 'data-uid': d.uid },
    h('div.cube-shadow'),
    body,
  );
  return {
    el,
    body,
    faces,
    setFace(index, value) {
      faces[index].replaceChildren(pips(value));
    },
    orient(index, spins, z) {
      const [rx, ry] = FACE_ROT[index];
      return `rotateZ(${z}deg) rotateX(${rx + 360 * spins}deg) rotateY(${ry + 360 * spins}deg)`;
    },
  };
}

export function faceIndexFor(d: Die, value: number, standardFaces = false): number {
  const values = standardFaces ? [1, 2, 3, 4, 5, 6] : d.faces;
  const matches = values.map((v, i) => (v === value ? i : -1)).filter((i) => i >= 0);
  if (matches.length) return matches[Math.floor(Math.random() * matches.length)];
  return 0;
}
