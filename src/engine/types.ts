export const WILD = 0;
export type Face = number; // 1..6, or WILD

export type FaceSetId = 'standard' | 'loaded' | 'lowball' | 'highball' | 'odd' | 'even' | 'twoface' | 'midway' | 'wild';
export type ModId =
  'gold' | 'glass' | 'steel' | 'hot' | 'lucky' | 'ruby' | 'heavy' | 'echo' | 'mirror' | 'twin' | 'spinner';

export type HandId =
  | 'high'
  | 'pair'
  | 'twopair'
  | 'three'
  | 'smallstr'
  | 'fullhouse'
  | 'largestr'
  | 'four'
  | 'threepair'
  | 'five'
  | 'twotrips'
  | 'grand'
  | 'six';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type TableKind = 'low' | 'high' | 'boss';

export interface Die {
  uid: string;
  faceSet: FaceSetId;
  faces: Face[];
  mods: ModId[];
  hotChips: number;
}

export interface CharmInst {
  uid: string;
  id: string;
  data: Record<string, number>;
  sellBonus: number;
}

export interface ConsumableInst {
  uid: string;
  id: string;
}

/** A die on the felt. Temp dice (Twin copies, Double Down) vanish after the throw. */
export interface TableDie {
  id: string;
  uid: string; // the Box die it came from
  face: Face; // as rolled (may be WILD)
  held: boolean;
  temp: boolean;
}

export interface TableState {
  kind: TableKind;
  bossId: string | null;
  bossRules: string[];
  target: number;
  score: number;
  throwsLeft: number;
  throwsUsed: number;
  rerollsLeft: number;
  rerollsUsed: number;
  rerollsThisThrow: number;
  cupSize: number;
  dice: TableDie[] | null; // null until the cup is thrown
  nextDieId: number;
  handsScored: Partial<Record<HandId, number>>;
  lockedHand: HandId | null;
  history: ThrowSummary[];
  finished: 'won' | 'lost' | null;
  bestThrow: number;
}

export interface ThrowSummary {
  hand: HandId;
  faces: number[];
  score: number;
}

export type ShopItem =
  | { kind: 'charm'; id: string; price: number; sold: boolean }
  | { kind: 'consumable'; id: string; price: number; sold: boolean }
  | { kind: 'die'; die: Die; price: number; sold: boolean }
  | { kind: 'pack'; id: string; price: number; sold: boolean }
  | { kind: 'upgrade'; id: string; price: number; sold: boolean };

export type PackOption = { kind: 'charm'; id: string } | { kind: 'consumable'; id: string } | { kind: 'die'; die: Die };

export interface OpenPack {
  packId: string;
  options: PackOption[];
  picksLeft: number;
}

export interface ShopState {
  items: ShopItem[];
  dice: ShopItem[];
  packs: ShopItem[];
  upgrade: ShopItem | null;
  restockCost: number;
  openPack: OpenPack | null;
}

export interface PayoutLine {
  label: string;
  amount: number;
}

export interface Payout {
  lines: PayoutLine[];
  total: number;
}

export interface RunStats {
  throws: number;
  rerolls: number;
  bestThrow: number;
  hands: Record<HandId, number>;
  tablesWon: number;
  moneyEarned: number;
  dupes: number;
}

export type RunPhase = 'select' | 'table' | 'payout' | 'shop' | 'gameover' | 'victory';

export interface RunState {
  version: number;
  seed: string;
  rng: number;
  profileId: string;
  stake: number;
  ante: number;
  tableIndex: number; // 0 low, 1 high, 2 boss
  money: number;
  box: Die[];
  cup: string[];
  charms: CharmInst[];
  consumables: ConsumableInst[];
  levels: Record<HandId, number>;
  upgrades: string[];
  bossByAnte: Record<number, { id: string; rules: string[] }>;
  usedBosses: string[];
  phase: RunPhase;
  table: TableState | null;
  payout: Payout | null;
  shop: ShopState | null;
  shopUpgradeBoughtAnte: number;
  stats: RunStats;
  nextUid: number;
  endless: boolean;
  upgradeOffer: { ante: number; id: string } | null;
}

export interface Limits {
  charmSlots: number;
  consumableSlots: number;
  cupSize: number;
  boxSize: number;
  throws: number;
  rerolls: number;
  interestCap: number;
  restockBase: number;
  priceMul: number;
}
