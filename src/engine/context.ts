import type { CharmInst, Die, HandId, RunState, TableDie, TableState } from './types';

/** A thrown die after Mirror and Wild are resolved. */
export interface ScoredDie {
  id: string; // table die id
  die: Die;
  face: number; // 1..6
  wild: boolean;
  mirrored: boolean;
  temp: boolean;
  debuffed: boolean;
}

export interface ScoreCtx {
  run: RunState;
  table: TableState;
  hand: HandId;
  /** Every hand the scoring dice make, e.g. a Full House contains a Pair. */
  contains: Set<HandId>;
  dice: ScoredDie[];
  scoring: ScoredDie[];
  idle: ScoredDie[];
  throwIndex: number;
  isFirstThrow: boolean;
  isLastThrow: boolean;
  rerollsThisThrow: number;
  cupSize: number;
  dry: boolean;
}

export interface Scorer {
  chips(n: number): void;
  mult(n: number): void;
  xmult(x: number): void;
  money(n: number): void;
  rerolls(n: number): void;
  /** Probability roll with Four-Leaf scaling. Always false on dry runs. */
  roll(oneIn: number): boolean;
}

export interface AfterScoreCtx {
  run: RunState;
  table: TableState;
  hand: HandId;
  contains: Set<HandId>;
  scoring: ScoredDie[];
  total: number;
  roll(oneIn: number): boolean;
  rerollsThisThrow: number;
  /** Charms push extra effects here (level ups, clones). */
  levelUp(hand: HandId): void;
  clone(die: Die): boolean;
}

export interface ThrowCtx {
  run: RunState;
  table: TableState;
  dice: TableDie[];
  /** Adds a temp die showing `face` to this throw. */
  addDie(fromUid: string, face: number): TableDie;
}

export interface CharmPassive {
  throws?: number;
  rerolls?: number;
  cupSize?: number;
  probMul?: number;
  allScore?: boolean;
  shortcut?: boolean;
  fourFingers?: boolean;
  noRerolls?: boolean;
  doubleCocktails?: boolean;
  onesWild?: boolean;
}

export interface CharmDef {
  id: string;
  name: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare';
  price: number;
  desc: string;
  /** Extra line for scaling charms, shown under the description. */
  status?(inst: CharmInst, run: RunState): string;
  passive?: CharmPassive;
  /** Runs once for each scoring die, each time it triggers. */
  onDie?(c: ScoreCtx, d: ScoredDie, s: Scorer, inst: CharmInst): void;
  /** Extra triggers for a scoring die. */
  retrigger?(c: ScoreCtx, d: ScoredDie, index: number, inst: CharmInst): number;
  /** Runs once for each thrown die that doesn't score. */
  onIdle?(c: ScoreCtx, d: ScoredDie, s: Scorer, inst: CharmInst): void;
  /** Runs after all dice, left to right across your charms. */
  score?(c: ScoreCtx, s: Scorer, inst: CharmInst): void;
  afterScore?(a: AfterScoreCtx, inst: CharmInst): string | void;
  onThrow?(t: ThrowCtx, inst: CharmInst): string | void;
  onReroll?(run: RunState, table: TableState, inst: CharmInst): void;
  onCocktail?(run: RunState, inst: CharmInst): void;
  onDupe?(run: RunState, inst: CharmInst, n: number): void;
  onShatter?(run: RunState, inst: CharmInst): void;
  onLucky?(run: RunState, inst: CharmInst): void;
  tableStart?(run: RunState, table: TableState, inst: CharmInst): void;
  tableEnd?(
    run: RunState,
    table: TableState,
    inst: CharmInst,
  ): { money?: number; note?: string; cocktail?: boolean; destroy?: boolean } | void;
}
