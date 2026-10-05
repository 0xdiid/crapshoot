import type { HandId, ModId } from '../types';
import { HANDS } from './hands';

export interface CocktailDef {
  kind: 'cocktail';
  id: string;
  name: string;
  icon: string;
  level: HandId;
  desc: string;
  price: number;
}

export type TokenEffect =
  | { type: 'mod'; mod: ModId }
  | { type: 'chisel' }
  | { type: 'sandpaper' }
  | { type: 'wildcard' }
  | { type: 'photocopy' }
  | { type: 'solvent' };

export interface TokenDef {
  kind: 'token';
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  effect: TokenEffect;
}

export type TrickEffect = 'nudge_up' | 'nudge_down' | 'flip' | 'double_down' | 'second_wind' | 'overtime';

/** Tricks are used at the table, mid-throw. */
export interface TrickDef {
  kind: 'trick';
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  effect: TrickEffect;
  /** Needs a thrown die to target. */
  targeted: boolean;
}

export type ConsumableDef = CocktailDef | TokenDef | TrickDef;

const cocktails: CocktailDef[] = (
  [
    { id: 'club_soda', name: 'Club Soda', icon: '🫧', level: 'high' },
    { id: 'pair_of_pints', name: 'Pair of Pints', icon: '🍻', level: 'pair' },
    { id: 'two_step', name: 'Two Step', icon: '🥂', level: 'twopair' },
    { id: 'triple_sec', name: 'Triple Sec', icon: '🍊', level: 'three' },
    { id: 'short_straw', name: 'Short Straw', icon: '🧃', level: 'smallstr' },
    { id: 'house_red', name: 'House Red', icon: '🍷', level: 'fullhouse' },
    { id: 'long_island', name: 'Long Island', icon: '🍹', level: 'largestr' },
    { id: 'four_roses', name: 'Four Roses', icon: '🌹', level: 'four' },
    { id: 'three_wise_men', name: 'Three Wise Men', icon: '🧉', level: 'threepair' },
    { id: 'fifth', name: 'The Fifth', icon: '🥃', level: 'five' },
    { id: 'double_trouble', name: 'Double Trouble', icon: '🍶', level: 'twotrips' },
    { id: 'grand_marnier', name: 'Grand Marnier', icon: '🍾', level: 'grand' },
    { id: 'six_pack', name: 'Six Pack', icon: '🍺', level: 'six' },
  ] as Omit<CocktailDef, 'kind' | 'price' | 'desc'>[]
).map((c) => ({ ...c, kind: 'cocktail' as const, price: 3, desc: `Level up ${HANDS[c.level].name}` }));

const tokens: TokenDef[] = (
  [
    { id: 'gold_leaf', name: 'Gold Leaf', icon: '💰', desc: 'Add Gold to a die', effect: { type: 'mod', mod: 'gold' } },
    {
      id: 'blown_glass',
      name: 'Blown Glass',
      icon: '💎',
      desc: 'Add Glass to a die',
      effect: { type: 'mod', mod: 'glass' },
    },
    {
      id: 'steel_plate',
      name: 'Steel Plate',
      icon: '🔩',
      desc: 'Add Steel to a die',
      effect: { type: 'mod', mod: 'steel' },
    },
    { id: 'hot_sauce', name: 'Hot Sauce', icon: '🌶️', desc: 'Add Hot to a die', effect: { type: 'mod', mod: 'hot' } },
    { id: 'clover', name: 'Clover', icon: '🍀', desc: 'Add Lucky to a die', effect: { type: 'mod', mod: 'lucky' } },
    { id: 'ruby_dust', name: 'Ruby Dust', icon: '❤️', desc: 'Add Ruby to a die', effect: { type: 'mod', mod: 'ruby' } },
    {
      id: 'lead_weight',
      name: 'Lead Weight',
      icon: '🪨',
      desc: 'Add Heavy to a die',
      effect: { type: 'mod', mod: 'heavy' },
    },
    {
      id: 'tuning_fork',
      name: 'Tuning Fork',
      icon: '🔁',
      desc: 'Add Echo to a die',
      effect: { type: 'mod', mod: 'echo' },
    },
    {
      id: 'mirror_shard',
      name: 'Mirror Shard',
      icon: '🪞',
      desc: 'Add Mirror to a die',
      effect: { type: 'mod', mod: 'mirror' },
    },
    {
      id: 'petri_dish',
      name: 'Petri Dish',
      icon: '🧫',
      desc: 'Add Twin to a die',
      effect: { type: 'mod', mod: 'twin' },
    },
    {
      id: 'top_spin',
      name: 'Top Spin',
      icon: '🌀',
      desc: 'Add Spinner to a die',
      effect: { type: 'mod', mod: 'spinner' },
    },
    { id: 'chisel', name: 'Chisel', icon: '🔨', desc: "Turn a die's lowest face into a 6", effect: { type: 'chisel' } },
    {
      id: 'sandpaper',
      name: 'Sandpaper',
      icon: '🧽',
      desc: "Turn a die's highest face into a 1",
      effect: { type: 'sandpaper' },
    },
    {
      id: 'wildcard',
      name: 'Wildcard',
      icon: '🌈',
      desc: "Turn a die's lowest face Wild",
      effect: { type: 'wildcard' },
    },
    {
      id: 'photocopy',
      name: 'Photocopy',
      icon: '📠',
      desc: 'Duplicate a die (needs Box space)',
      effect: { type: 'photocopy' },
    },
    {
      id: 'solvent',
      name: 'Solvent',
      icon: '🧴',
      desc: 'Strip all mods from a die. Earn $4 per mod',
      effect: { type: 'solvent' },
    },
  ] as Omit<TokenDef, 'kind' | 'price'>[]
).map((t) => ({ ...t, kind: 'token' as const, price: 3 }));

const tricks: TrickDef[] = (
  [
    {
      id: 'nudge_up',
      name: 'Nudge Up',
      icon: '⬆️',
      desc: 'Add 1 to a thrown die (up to 6)',
      effect: 'nudge_up',
      targeted: true,
    },
    {
      id: 'nudge_down',
      name: 'Nudge Down',
      icon: '⬇️',
      desc: 'Take 1 from a thrown die (down to 1)',
      effect: 'nudge_down',
      targeted: true,
    },
    {
      id: 'flip',
      name: 'Flip',
      icon: '🙃',
      desc: 'Flip a thrown die to its opposite side (1 and 6, 2 and 5, 3 and 4)',
      effect: 'flip',
      targeted: true,
    },
    {
      id: 'double_down',
      name: 'Double Down',
      icon: '✌️',
      desc: 'Duplicate a thrown die for this Throw',
      effect: 'double_down',
      targeted: true,
    },
    {
      id: 'second_wind',
      name: 'Second Wind',
      icon: '🌬️',
      desc: '+2 Rerolls this table',
      effect: 'second_wind',
      targeted: false,
    },
    { id: 'overtime', name: 'Overtime', icon: '⏰', desc: '+1 Throw this table', effect: 'overtime', targeted: false },
  ] as Omit<TrickDef, 'kind' | 'price'>[]
).map((t) => ({ ...t, kind: 'trick' as const, price: t.effect === 'overtime' ? 5 : 3 }));

export const CONSUMABLES: Record<string, ConsumableDef> = Object.fromEntries(
  [...cocktails, ...tokens, ...tricks].map((c) => [c.id, c]),
);
export const COCKTAIL_IDS = cocktails.map((c) => c.id);
export const TOKEN_IDS = tokens.map((t) => t.id);
export const TRICK_IDS = tricks.map((t) => t.id);

export function cocktailFor(level: HandId): CocktailDef {
  return cocktails.find((c) => c.level === level)!;
}
