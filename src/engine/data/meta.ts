import type { FaceSetId, Limits, ModId } from '../types';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  apply(l: Limits): void;
}

export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries(
  (
    [
      { id: 'extra_throw', name: 'Extra Throw', icon: '🎲', desc: '+1 Throw every table', apply: (l) => (l.throws += 1) },
      { id: 'second_wind', name: 'Deep Breath', icon: '🌬️', desc: '+1 Reroll every table', apply: (l) => (l.rerolls += 1) },
      { id: 'big_cup', name: 'Big Cup', icon: '🥤', desc: '+1 die in your Cup', apply: (l) => (l.cupSize += 1) },
      { id: 'charm_rack', name: 'Charm Rack', icon: '🧿', desc: '+1 Charm slot', apply: (l) => (l.charmSlots += 1) },
      { id: 'bar_tab', name: 'Bar Tab', icon: '🧾', desc: '+1 Comp slot', apply: (l) => (l.consumableSlots += 1) },
      { id: 'clearance', name: 'Clearance', icon: '🏷️', desc: 'Everything in the shop is 25% off', apply: (l) => (l.priceMul *= 0.75) },
      { id: 'restock_deal', name: 'Restock Deal', icon: '🔄', desc: 'Restocking the shop costs $2 less', apply: (l) => (l.restockBase -= 2) },
      { id: 'vault', name: 'The Vault', icon: '🏦', desc: 'Max interest raised to $10', apply: (l) => (l.interestCap = 10) },
      { id: 'dice_rack', name: 'Dice Rack', icon: '🗄️', desc: '+2 Box slots', apply: (l) => (l.boxSize += 2) },
    ] as Omit<UpgradeDef, 'price'>[]
  ).map((u) => [u.id, { ...u, price: 10 }]),
);
export const UPGRADE_IDS = Object.keys(UPGRADES);

export interface PackDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  contents: 'charm' | 'cocktail' | 'token' | 'trick' | 'die';
  size: number;
  color: string;
}

export const PACKS: Record<string, PackDef> = {
  cocktail_menu: {
    id: 'cocktail_menu',
    name: 'Cocktail Menu',
    icon: '🍹',
    desc: 'Pick 1 of 3 Cocktails. Drink it now',
    price: 4,
    contents: 'cocktail',
    size: 3,
    color: '#f20884',
  },
  charm_box: {
    id: 'charm_box',
    name: 'Charm Box',
    icon: '🎁',
    desc: 'Pick 1 of 3 Charms',
    price: 5,
    contents: 'charm',
    size: 3,
    color: '#fcf305',
  },
  dice_cup: {
    id: 'dice_cup',
    name: 'Dice Cup',
    icon: '🥤',
    desc: 'Pick 1 of 3 Dice',
    price: 4,
    contents: 'die',
    size: 3,
    color: '#1fb714',
  },
  token_pouch: {
    id: 'token_pouch',
    name: 'Token Pouch',
    icon: '👝',
    desc: 'Pick 1 of 3 Tokens. Use it now',
    price: 4,
    contents: 'token',
    size: 3,
    color: '#02abea',
  },
  trick_deck: {
    id: 'trick_deck',
    name: 'Trick Deck',
    icon: '🎩',
    desc: 'Pick 1 of 3 Tricks to keep for the table',
    price: 4,
    contents: 'trick',
    size: 3,
    color: '#4700a5',
  },
};
export const PACK_IDS = Object.keys(PACKS);

export interface ProfileDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  dice: { faceSet: FaceSetId; mods?: ModId[] }[];
  charms?: string[];
  consumables?: string[];
  money: number;
  targetMul?: number;
  color: string;
}

const std = { faceSet: 'standard' as const };

export const PROFILES: ProfileDef[] = [
  {
    id: 'rookie',
    name: 'The Rookie',
    icon: '🧢',
    desc: 'Five honest dice. Learn the table.',
    dice: [std, std, std, std, std],
    money: 4,
    color: '#02abea',
  },
  {
    id: 'hustler',
    name: 'The Hustler',
    icon: '🕶️',
    desc: 'Two Loaded dice: no 1s, extra 6s.',
    dice: [std, std, std, { faceSet: 'loaded' }, { faceSet: 'loaded' }],
    money: 4,
    color: '#dd0806',
  },
  {
    id: 'gemini',
    name: 'The Gemini',
    icon: '👯',
    desc: 'Four dice, but one is a Twin that splits in two every throw.',
    dice: [std, std, std, { faceSet: 'standard', mods: ['twin'] }],
    money: 4,
    color: '#f20884',
  },
  {
    id: 'tinker',
    name: 'The Tinker',
    icon: '🔧',
    desc: 'Steady Hand (+2 Rerolls) and a Chisel to start.',
    dice: [std, std, std, std, std],
    charms: ['steady_hand'],
    consumables: ['chisel'],
    money: 2,
    color: '#1fb714',
  },
  {
    id: 'minimalist',
    name: 'The Minimalist',
    icon: '🪶',
    desc: 'Only four dice, but Light Pockets doubles Mult for the empty slot.',
    dice: [std, std, std, std],
    charms: ['light_pockets'],
    money: 4,
    color: '#c0c0c0',
  },
  {
    id: 'whale',
    name: 'The Whale',
    icon: '🐋',
    desc: '$10 and a Lucky Penny, but every target is 75% higher.',
    dice: [std, std, std, std, std],
    charms: ['lucky_penny'],
    money: 10,
    targetMul: 1.75,
    color: '#4700a5',
  },
];

export const STAKES = [
  {
    id: 0,
    name: 'White Chip',
    color: '#f4efe6',
    desc: 'The standard game',
    targetMul: 1,
    rerollsDelta: 0,
    interest: true,
  },
  {
    id: 1,
    name: 'Red Chip',
    color: '#e5383b',
    desc: 'Targets +25%',
    targetMul: 1.25,
    rerollsDelta: 0,
    interest: true,
  },
  {
    id: 2,
    name: 'Green Chip',
    color: '#2dc653',
    desc: 'Red, plus one fewer Reroll',
    targetMul: 1.25,
    rerollsDelta: -1,
    interest: true,
  },
  {
    id: 3,
    name: 'Black Chip',
    color: '#222',
    desc: 'Green, plus no interest',
    targetMul: 1.4,
    rerollsDelta: -1,
    interest: false,
  },
];

export const BASE_LIMITS: Limits = {
  charmSlots: 5,
  consumableSlots: 2,
  cupSize: 5,
  boxSize: 8,
  throws: 4,
  rerolls: 5,
  interestCap: 5,
  restockBase: 5,
  priceMul: 1,
};

export const ANTE_TARGETS = [200, 500, 1100, 2200, 3600, 6000, 11000, 20000];
export const TABLE_MULS = [1, 1.5, 2];
export const TABLE_REWARDS = [3, 4, 5];
export const FINAL_ANTE = 8;
