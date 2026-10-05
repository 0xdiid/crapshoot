import type { HandId } from '../types';

export interface HandDef {
  id: HandId;
  name: string;
  desc: string;
  chips: number;
  mult: number;
  lvlChips: number;
  lvlMult: number;
  /** Dice needed to make it at all. Hands above 5 are secret until your Cup is big enough. */
  minDice: number;
  color: string;
}

const list: HandDef[] = [
  {
    id: 'high',
    name: 'High Die',
    desc: 'Your single highest die',
    chips: 5,
    mult: 1,
    lvlChips: 10,
    lvlMult: 1,
    minDice: 1,
    color: '#c0c0c0',
  },
  {
    id: 'pair',
    name: 'Pair',
    desc: 'Two dice showing the same face',
    chips: 10,
    mult: 2,
    lvlChips: 15,
    lvlMult: 1,
    minDice: 2,
    color: '#ffffff',
  },
  {
    id: 'twopair',
    name: 'Two Pair',
    desc: 'Two different Pairs',
    chips: 20,
    mult: 2,
    lvlChips: 20,
    lvlMult: 1,
    minDice: 4,
    color: '#02abea',
  },
  {
    id: 'three',
    name: 'Three of a Kind',
    desc: 'Three dice showing the same face',
    chips: 25,
    mult: 3,
    lvlChips: 20,
    lvlMult: 2,
    minDice: 3,
    color: '#1fb714',
  },
  {
    id: 'smallstr',
    name: 'Small Straight',
    desc: 'Four faces in a row, like 2-3-4-5',
    chips: 30,
    mult: 3,
    lvlChips: 20,
    lvlMult: 2,
    minDice: 4,
    color: '#fcf305',
  },
  {
    id: 'fullhouse',
    name: 'Full House',
    desc: 'Three of a Kind plus a Pair',
    chips: 35,
    mult: 4,
    lvlChips: 25,
    lvlMult: 2,
    minDice: 5,
    color: '#ff6403',
  },
  {
    id: 'largestr',
    name: 'Large Straight',
    desc: 'Five faces in a row, like 1-2-3-4-5',
    chips: 40,
    mult: 4,
    lvlChips: 30,
    lvlMult: 2,
    minDice: 5,
    color: '#f20884',
  },
  {
    id: 'four',
    name: 'Four of a Kind',
    desc: 'Four dice showing the same face',
    chips: 45,
    mult: 5,
    lvlChips: 30,
    lvlMult: 3,
    minDice: 4,
    color: '#4700a5',
  },
  {
    id: 'threepair',
    name: 'Three Pair',
    desc: 'Three different Pairs',
    chips: 40,
    mult: 4,
    lvlChips: 25,
    lvlMult: 2,
    minDice: 6,
    color: '#0000d4',
  },
  {
    id: 'five',
    name: 'Five of a Kind',
    desc: 'Five dice showing the same face',
    chips: 80,
    mult: 8,
    lvlChips: 35,
    lvlMult: 3,
    minDice: 5,
    color: '#dd0806',
  },
  {
    id: 'twotrips',
    name: 'Two Triples',
    desc: 'Two different Three of a Kinds',
    chips: 60,
    mult: 6,
    lvlChips: 30,
    lvlMult: 3,
    minDice: 6,
    color: '#006411',
  },
  {
    id: 'grand',
    name: 'Grand Straight',
    desc: 'All six faces, 1 through 6',
    chips: 70,
    mult: 7,
    lvlChips: 35,
    lvlMult: 3,
    minDice: 6,
    color: '#90713a',
  },
  {
    id: 'six',
    name: 'Six of a Kind',
    desc: 'Six dice showing the same face',
    chips: 120,
    mult: 12,
    lvlChips: 40,
    lvlMult: 4,
    minDice: 6,
    color: '#000000',
  },
];

export const HANDS: Record<HandId, HandDef> = Object.fromEntries(list.map((h) => [h.id, h])) as Record<HandId, HandDef>;
export const HAND_ORDER: HandId[] = list.map((h) => h.id);

export function handValues(id: HandId, level: number): { chips: number; mult: number } {
  const h = HANDS[id];
  const l = Math.max(0, level - 1);
  return { chips: h.chips + h.lvlChips * l, mult: h.mult + h.lvlMult * l };
}

export interface HandRules {
  /** Straights may skip one face between steps. */
  shortcut?: boolean;
  /** Straights need one fewer die. */
  fourFingers?: boolean;
}

export type HandMap = Partial<Record<HandId, number[]>>;

const STRAIGHT_LEN: [HandId, number][] = [
  ['grand', 6],
  ['largestr', 5],
  ['smallstr', 4],
];

/**
 * Every hand made by these faces (1..6), with the indices of the dice that form it.
 * Where there is a choice, the dice with the highest faces are used.
 */
export function findHands(faces: number[], rules: HandRules = {}): HandMap {
  const out: HandMap = {};
  if (faces.length === 0) return out;
  const byFace: number[][] = [[], [], [], [], [], [], []];
  faces.forEach((f, i) => byFace[f]?.push(i));
  const desc = [6, 5, 4, 3, 2, 1];
  const withAtLeast = (n: number, not: number[] = []) => desc.filter((f) => byFace[f].length >= n && !not.includes(f));
  const take = (f: number, n: number) => byFace[f].slice(0, n);

  const hi = faces.reduce((b, f, i) => (f > faces[b] ? i : b), 0);
  out.high = [hi];

  for (const [id, n] of [
    ['pair', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
  ] as [HandId, number][]) {
    const f = withAtLeast(n)[0];
    if (f) out[id] = take(f, n);
  }

  const pairs = withAtLeast(2);
  if (pairs.length >= 2) out.twopair = [...take(pairs[0], 2), ...take(pairs[1], 2)];
  if (pairs.length >= 3) out.threepair = [...take(pairs[0], 2), ...take(pairs[1], 2), ...take(pairs[2], 2)];
  const trips = withAtLeast(3);
  if (trips.length >= 2) out.twotrips = [...take(trips[0], 3), ...take(trips[1], 3)];
  if (trips.length >= 1) {
    const two = withAtLeast(2, [trips[0]])[0];
    if (two) out.fullhouse = [...take(trips[0], 3), ...take(two, 2)];
  }

  // Straights: find the longest chain of distinct faces, highest first.
  const present = [1, 2, 3, 4, 5, 6].filter((f) => byFace[f].length > 0);
  const gap = rules.shortcut ? 2 : 1;
  let best: number[] = [];
  let run: number[] = [];
  for (const f of present) {
    if (run.length && f - run[run.length - 1] > gap) run = [];
    run.push(f);
    if (run.length >= best.length) best = [...run];
  }
  const shave = rules.fourFingers ? 1 : 0;
  for (const [id, len] of STRAIGHT_LEN) {
    const need = id === 'grand' ? 6 : len - shave;
    if (best.length >= need) out[id] = best.slice(best.length - need).map((f) => byFace[f][0]);
  }
  return out;
}

/** Hands that "contain" another, for charms like "if the hand contains a Pair". */
export function containedHands(scoringFaces: number[], rules: HandRules = {}): Set<HandId> {
  return new Set(Object.keys(findHands(scoringFaces, rules)) as HandId[]);
}

export const STRAIGHTS: HandId[] = ['smallstr', 'largestr', 'grand'];
export const OF_A_KIND: HandId[] = ['three', 'four', 'five', 'six'];
