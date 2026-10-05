import type { Face, FaceSetId, ModId, Rarity } from '../types';
import { WILD } from '../types';

export interface FaceSetDef {
  id: FaceSetId;
  name: string;
  faces: Face[];
  desc: string;
  body: string; // die body color
  pip: string; // pip color
  rarity: Rarity;
}

export const FACE_SETS: Record<FaceSetId, FaceSetDef> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    faces: [1, 2, 3, 4, 5, 6],
    desc: 'A fair die.',
    body: '#ffffff',
    pip: '#000000',
    rarity: 'common',
  },
  loaded: {
    id: 'loaded',
    name: 'Loaded',
    faces: [2, 3, 4, 5, 6, 6],
    desc: 'No 1s, two 6s. More pips, more Chips.',
    body: '#dd0806',
    pip: '#ffffff',
    rarity: 'common',
  },
  lowball: {
    id: 'lowball',
    name: 'Lowball',
    faces: [1, 1, 2, 2, 3, 3],
    desc: 'Only 1s, 2s and 3s. Lowballs match each other a lot.',
    body: '#0000d4',
    pip: '#ffffff',
    rarity: 'uncommon',
  },
  highball: {
    id: 'highball',
    name: 'Highball',
    faces: [4, 4, 5, 5, 6, 6],
    desc: 'Only 4s, 5s and 6s. Big matches, big pips.',
    body: '#ff6403',
    pip: '#000000',
    rarity: 'uncommon',
  },
  odd: {
    id: 'odd',
    name: 'Odd',
    faces: [1, 1, 3, 3, 5, 5],
    desc: 'Only odd faces. Great for sets, useless for straights.',
    body: '#4700a5',
    pip: '#ffffff',
    rarity: 'common',
  },
  even: {
    id: 'even',
    name: 'Even',
    faces: [2, 2, 4, 4, 6, 6],
    desc: 'Only even faces. Great for sets, useless for straights.',
    body: '#02abea',
    pip: '#000000',
    rarity: 'common',
  },
  twoface: {
    id: 'twoface',
    name: 'Two-Face',
    faces: [1, 1, 1, 6, 6, 6],
    desc: 'Only 1s and 6s. A coin flip that loves Full Houses.',
    body: '#000000',
    pip: '#ffffff',
    rarity: 'uncommon',
  },
  midway: {
    id: 'midway',
    name: 'Midway',
    faces: [2, 3, 3, 4, 4, 5],
    desc: 'Hugs the middle. Fills small straights.',
    body: '#1fb714',
    pip: '#000000',
    rarity: 'common',
  },
  wild: {
    id: 'wild',
    name: 'Wild',
    faces: [WILD, 2, 3, 4, 5, 6],
    desc: 'The Wild face counts as whatever number makes your best hand.',
    body: '#ffffff',
    pip: '#000000',
    rarity: 'rare',
  },
};

export interface ModDef {
  id: ModId;
  name: string;
  icon: string;
  desc: string;
  color: string;
  rarity: Rarity;
}

export const MODS: Record<ModId, ModDef> = {
  gold: { id: 'gold', name: 'Gold', icon: '💰', desc: '+$1 when it scores', color: '#fcf305', rarity: 'common' },
  glass: {
    id: 'glass',
    name: 'Glass',
    icon: '💎',
    desc: 'x2 Mult when it scores. 1 in 6 chance to shatter',
    color: '#02abea',
    rarity: 'uncommon',
  },
  steel: {
    id: 'steel',
    name: 'Steel',
    icon: '🔩',
    desc: "x1.5 Mult when it's thrown but doesn't score",
    color: '#c0c0c0',
    rarity: 'uncommon',
  },
  hot: {
    id: 'hot',
    name: 'Hot',
    icon: '🌶️',
    desc: 'Gains +4 Chips for good every time it scores',
    color: '#ff6403',
    rarity: 'common',
  },
  lucky: {
    id: 'lucky',
    name: 'Lucky',
    icon: '🍀',
    desc: 'When it scores: 1 in 4 for +12 Mult, 1 in 12 for +$5',
    color: '#1fb714',
    rarity: 'common',
  },
  ruby: { id: 'ruby', name: 'Ruby', icon: '❤️', desc: '+Mult equal to its face when it scores', color: '#dd0806', rarity: 'common' },
  heavy: { id: 'heavy', name: 'Heavy', icon: '🪨', desc: 'Its pips count x5 as Chips', color: '#808080', rarity: 'common' },
  echo: {
    id: 'echo',
    name: 'Echo',
    icon: '🔁',
    desc: 'Scores twice: pips and mods trigger again',
    color: '#4700a5',
    rarity: 'uncommon',
  },
  mirror: {
    id: 'mirror',
    name: 'Mirror',
    icon: '🪞',
    desc: 'Always shows the most common face among your other dice',
    color: '#02abea',
    rarity: 'rare',
  },
  twin: {
    id: 'twin',
    name: 'Twin',
    icon: '👯',
    desc: 'Splits in two when thrown: a copy joins every throw',
    color: '#f20884',
    rarity: 'uncommon',
  },
  spinner: {
    id: 'spinner',
    name: 'Spinner',
    icon: '🌀',
    desc: '+1 Reroll when it scores',
    color: '#0000d4',
    rarity: 'uncommon',
  },
};

export const MAX_MODS = 3;
export const MOD_IDS = Object.keys(MODS) as ModId[];
export const FACE_SET_IDS = Object.keys(FACE_SETS) as FaceSetId[];
