import type { CharmPassive } from './context';
import { CHARMS } from './data/charms';
import { FACE_SETS, MODS } from './data/dice';
import { BASE_LIMITS, PROFILES, STAKES, UPGRADES } from './data/meta';
import type { CharmInst, Die, FaceSetId, HandId, Limits, ModId, RunState } from './types';

export class GameError extends Error {}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new GameError(msg);
}

export function profileOf(run: RunState) {
  return PROFILES.find((p) => p.id === run.profileId) ?? PROFILES[0];
}

export function stakeOf(run: RunState) {
  return STAKES[run.stake] ?? STAKES[0];
}

export interface Passives extends Required<CharmPassive> {}

export function passives(run: RunState): Passives {
  const p: Passives = {
    throws: 0,
    rerolls: 0,
    cupSize: 0,
    probMul: 1,
    allScore: false,
    shortcut: false,
    fourFingers: false,
    noRerolls: false,
    doubleCocktails: false,
    onesWild: false,
  };
  for (const c of run.charms) {
    const d = CHARMS[c.id]?.passive;
    if (!d) continue;
    p.throws += d.throws ?? 0;
    p.rerolls += d.rerolls ?? 0;
    p.cupSize += d.cupSize ?? 0;
    p.probMul *= d.probMul ?? 1;
    p.allScore ||= !!d.allScore;
    p.shortcut ||= !!d.shortcut;
    p.fourFingers ||= !!d.fourFingers;
    p.noRerolls ||= !!d.noRerolls;
    p.doubleCocktails ||= !!d.doubleCocktails;
    p.onesWild ||= !!d.onesWild;
  }
  return p;
}

/** Slots, sizes and per-table allowances, including charms (but not boss rules). */
export function limits(run: RunState): Limits {
  const l = { ...BASE_LIMITS };
  for (const u of run.upgrades) UPGRADES[u]?.apply(l);
  const p = passives(run);
  l.rerolls += stakeOf(run).rerollsDelta + p.rerolls;
  l.throws += p.throws;
  l.cupSize += p.cupSize;
  if (p.noRerolls) l.rerolls = 0;
  l.throws = Math.max(1, l.throws);
  l.rerolls = Math.max(0, l.rerolls);
  l.restockBase = Math.max(1, l.restockBase);
  return l;
}

export function hasCharm(run: RunState, id: string): boolean {
  return run.charms.some((c) => c.id === id);
}

export function newUid(run: RunState, prefix: string): string {
  run.nextUid += 1;
  return `${prefix}${run.nextUid}`;
}

export function makeDie(run: RunState, faceSet: FaceSetId, mods: ModId[] = []): Die {
  return {
    uid: newUid(run, 'd'),
    faceSet,
    faces: [...FACE_SETS[faceSet].faces],
    mods: [...mods],
    hotChips: 0,
  };
}

export function makeCharm(run: RunState, id: string): CharmInst {
  return { uid: newUid(run, 'c'), id, data: {}, sellBonus: 0 };
}

export function getDie(run: RunState, uid: string): Die | undefined {
  return run.box.find((d) => d.uid === uid);
}

export function cupDice(run: RunState): Die[] {
  return run.cup.map((u) => getDie(run, u)).filter((d): d is Die => !!d);
}

/** Adds a new die to the Box, and to the Cup when there's room (unless you like it light). */
export function addToBox(run: RunState, die: Die): void {
  run.box.push(die);
  if (run.cup.length < limits(run).cupSize && !hasCharm(run, 'light_pockets')) run.cup.push(die.uid);
}

export function dieName(d: Die): string {
  const base = FACE_SETS[d.faceSet].name;
  if (d.mods.length === 0) return `${base} Die`;
  const mods = d.mods.map((m) => MODS[m].name);
  return `${mods.join(' ')} ${base === 'Standard' ? '' : base + ' '}Die`.replace(/\s+/g, ' ');
}

export function dieValue(d: Die): number {
  return 1 + d.mods.length;
}

export function charmSellValue(c: CharmInst): number {
  const def = CHARMS[c.id];
  return Math.max(1, Math.floor((def?.price ?? 2) / 2) + c.sellBonus);
}

export function price(run: RunState, base: number): number {
  return Math.max(1, Math.round(base * limits(run).priceMul));
}

/** Keeps the Box and Cup valid: at least one die thrown, never more than the Cup holds. */
export function ensureMinDice(run: RunState): void {
  if (run.box.length === 0) run.box.push(makeDie(run, 'standard'));
  run.cup = run.cup.filter((u, i) => getDie(run, u) && run.cup.indexOf(u) === i);
  if (run.cup.length === 0) run.cup.push(run.box[0].uid);
  const size = limits(run).cupSize;
  if (run.cup.length > size) run.cup = run.cup.slice(0, size);
}

export function levelUp(run: RunState, hand: HandId): number {
  const times = passives(run).doubleCocktails ? 2 : 1;
  run.levels[hand] += times;
  return times;
}

/** Records dice being duplicated, for charms that grow with it. */
export function noteDupe(run: RunState, n = 1): void {
  if (n <= 0) return;
  run.stats.dupes += n;
  for (const c of run.charms) CHARMS[c.id]?.onDupe?.(run, c, n);
}

export function cloneDie(run: RunState, die: Die): Die | null {
  if (run.box.length >= limits(run).boxSize) return null;
  const copy: Die = { ...die, uid: newUid(run, 'd'), faces: [...die.faces], mods: [...die.mods] };
  addToBox(run, copy);
  noteDupe(run, 1);
  return copy;
}
