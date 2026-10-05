import { CHARMS } from './data/charms';
import { COCKTAIL_IDS } from './data/consumables';
import { BOSSES, BOSS_IDS, EARLY_EXCLUDE, FINAL_BOSS, FINAL_EXCLUDE } from './data/bosses';
import { ANTE_TARGETS, FINAL_ANTE, TABLE_MULS, TABLE_REWARDS } from './data/meta';
import { HAND_ORDER } from './data/hands';
import { pick, seedFromString, shuffle, randomSeedString } from './rng';
import { generateShop } from './shop';
import { assert, ensureMinDice, limits, makeCharm, makeDie, newUid, profileOf, stakeOf } from './state';
import type { HandId, RunState, TableKind, TableState } from './types';

export const SAVE_VERSION = 2;

export interface NewRunOptions {
  profileId: string;
  seed?: string;
  stake?: number;
}

export function newRun(opts: NewRunOptions): RunState {
  const seed = (opts.seed ?? randomSeedString()).toUpperCase();
  const run: RunState = {
    version: SAVE_VERSION,
    seed,
    rng: seedFromString(seed),
    profileId: opts.profileId,
    stake: opts.stake ?? 0,
    ante: 1,
    tableIndex: 0,
    money: 0,
    box: [],
    cup: [],
    charms: [],
    consumables: [],
    levels: Object.fromEntries(HAND_ORDER.map((h) => [h, 1])) as Record<HandId, number>,
    upgrades: [],
    bossByAnte: {},
    usedBosses: [],
    phase: 'select',
    table: null,
    payout: null,
    shop: null,
    shopUpgradeBoughtAnte: 0,
    stats: {
      throws: 0,
      rerolls: 0,
      bestThrow: 0,
      hands: Object.fromEntries(HAND_ORDER.map((h) => [h, 0])) as Record<HandId, number>,
      tablesWon: 0,
      moneyEarned: 0,
      dupes: 0,
    },
    nextUid: 0,
    endless: false,
    upgradeOffer: null,
  };
  const prof = profileOf(run);
  run.money = prof.money;
  for (const d of prof.dice) run.box.push(makeDie(run, d.faceSet, d.mods ?? []));
  run.cup = run.box.map((d) => d.uid);
  for (const c of prof.charms ?? []) run.charms.push(makeCharm(run, c));
  for (const id of prof.consumables ?? []) run.consumables.push({ uid: newUid(run, 'k'), id });
  ensureMinDice(run);
  ensureBoss(run, 1);
  return run;
}

function roundNice(n: number): number {
  if (n < 1000) return Math.round(n / 10) * 10;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export function anteBase(ante: number): number {
  if (ante <= ANTE_TARGETS.length) return ANTE_TARGETS[ante - 1];
  const last = ANTE_TARGETS[ANTE_TARGETS.length - 1];
  return last * Math.pow(1.9, ante - ANTE_TARGETS.length);
}

export function ensureBoss(run: RunState, ante: number): { id: string; rules: string[] } {
  const existing = run.bossByAnte[ante];
  if (existing) return existing;
  let entry: { id: string; rules: string[] };
  if (ante % FINAL_ANTE === 0) {
    const pool = shuffle(
      run,
      BOSS_IDS.filter((b) => !FINAL_EXCLUDE.includes(b)),
    );
    entry = { id: FINAL_BOSS.id, rules: pool.slice(0, 2) };
  } else {
    let pool = BOSS_IDS.filter((b) => !run.usedBosses.includes(b));
    if (ante <= 2) pool = pool.filter((b) => !EARLY_EXCLUDE.includes(b));
    if (pool.length === 0) {
      run.usedBosses = [];
      pool = [...BOSS_IDS];
    }
    const id = pick(run, pool);
    run.usedBosses.push(id);
    entry = { id, rules: [id] };
  }
  run.bossByAnte[ante] = entry;
  return entry;
}

export interface Allowance {
  throws: number;
  rerolls: number;
  cupSize: number;
}

export interface TablePreview extends Allowance {
  index: number;
  kind: TableKind;
  name: string;
  target: number;
  reward: number;
  boss: { id: string; rules: string[] } | null;
}

export const TABLE_NAMES = ['Low Roller', 'High Roller', 'Pit Boss'];
const KINDS: TableKind[] = ['low', 'high', 'boss'];

export function tableTarget(run: RunState, ante: number, index: number): number {
  let t = anteBase(ante) * TABLE_MULS[index] * (profileOf(run).targetMul ?? 1) * stakeOf(run).targetMul;
  if (index === 2) {
    const b = ensureBoss(run, ante);
    const def = b.id === FINAL_BOSS.id ? FINAL_BOSS : BOSSES[b.id];
    t *= def.targetMul ?? 1;
    for (const r of b.rules) if (r !== b.id) t *= BOSSES[r]?.targetMul ?? 1;
  }
  return roundNice(t);
}

/** Throws, Rerolls and Cup size for a table, after boss rules. */
export function tableAllowance(run: RunState, index: number, ante = run.ante): Allowance {
  const lim = limits(run);
  const a: Allowance = { throws: lim.throws, rerolls: lim.rerolls, cupSize: lim.cupSize };
  if (index === 2) {
    for (const rule of ensureBoss(run, ante).rules) {
      const b = BOSSES[rule];
      if (!b) continue;
      a.throws += b.throwsDelta ?? 0;
      a.rerolls += b.rerollsDelta ?? 0;
      a.cupSize += b.cupDelta ?? 0;
    }
  }
  a.throws = Math.max(1, a.throws);
  a.rerolls = Math.max(0, a.rerolls);
  a.cupSize = Math.max(1, a.cupSize);
  return a;
}

export function anteTables(run: RunState, ante = run.ante): TablePreview[] {
  return [0, 1, 2].map((i) => ({
    index: i,
    kind: KINDS[i],
    name: TABLE_NAMES[i],
    target: tableTarget(run, ante, i),
    reward: TABLE_REWARDS[i],
    boss: i === 2 ? ensureBoss(run, ante) : null,
    ...tableAllowance(run, i, ante),
  }));
}

export function currentBossName(run: RunState, ante = run.ante): string {
  const b = ensureBoss(run, ante);
  return b.id === FINAL_BOSS.id ? FINAL_BOSS.name : BOSSES[b.id].name;
}

export function startTable(run: RunState): TableState {
  assert(run.phase === 'select', 'Not at table select');
  ensureMinDice(run);
  const idx = run.tableIndex;
  const boss = idx === 2 ? ensureBoss(run, run.ante) : null;
  const a = tableAllowance(run, idx);
  const t: TableState = {
    kind: KINDS[idx],
    bossId: boss?.id ?? null,
    bossRules: boss?.rules ?? [],
    target: tableTarget(run, run.ante, idx),
    score: 0,
    throwsLeft: a.throws,
    throwsUsed: 0,
    rerollsLeft: a.rerolls,
    rerollsUsed: 0,
    rerollsThisThrow: 0,
    cupSize: a.cupSize,
    dice: null,
    nextDieId: 0,
    handsScored: {},
    lockedHand: null,
    history: [],
    finished: null,
    bestThrow: 0,
  };
  run.table = t;
  run.phase = 'table';
  for (const c of run.charms) CHARMS[c.id]?.tableStart?.(run, t, c);
  return t;
}

export interface TableEndNote {
  charmUid: string;
  text: string;
}

/** Called by the roll/cash-out resolver when a table ends. Builds the payout or ends the run. */
export function finishTable(run: RunState, result: 'won' | 'lost'): TableEndNote[] {
  const t = run.table!;
  t.finished = result;
  const notes: TableEndNote[] = [];
  if (result === 'lost') {
    run.phase = 'gameover';
    return notes;
  }
  run.stats.tablesWon += 1;
  const lim = limits(run);
  const lines = [
    {
      label: `${TABLE_NAMES[run.tableIndex]} cleared`,
      amount: TABLE_REWARDS[run.tableIndex],
    },
  ];
  if (t.throwsLeft > 0)
    lines.push({
      label: `${t.throwsLeft} Throw${t.throwsLeft === 1 ? '' : 's'} left`,
      amount: t.throwsLeft,
    });
  if (stakeOf(run).interest) {
    const interest = Math.min(Math.floor(Math.max(0, run.money) / 5), lim.interestCap);
    if (interest > 0)
      lines.push({
        label: `Interest ($1 per $5, max $${lim.interestCap})`,
        amount: interest,
      });
  }
  for (const c of run.charms) {
    const def = CHARMS[c.id];
    const r = def?.tableEnd?.(run, t, c);
    if (!r) continue;
    if (r.destroy) c.data.destroyed = 1;
    if (r.money) lines.push({ label: def.name, amount: r.money });
    if (r.cocktail && run.consumables.length < lim.consumableSlots) {
      run.consumables.push({
        uid: newUid(run, 'k'),
        id: pick(run, COCKTAIL_IDS),
      });
      notes.push({ charmUid: c.uid, text: r.note ?? 'Free cocktail!' });
    } else if (r.note && !r.cocktail) {
      notes.push({ charmUid: c.uid, text: r.note });
    }
  }
  run.charms = run.charms.filter((c) => !c.data.destroyed);
  run.payout = { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
  run.phase = 'payout';
  return notes;
}

export function isFinalWin(run: RunState): boolean {
  return !run.endless && run.tableIndex === 2 && run.ante === FINAL_ANTE;
}

export function collectPayout(run: RunState): void {
  assert(run.phase === 'payout' && run.payout, 'No payout to collect');
  run.money += run.payout.total;
  run.stats.moneyEarned += run.payout.total;
  run.payout = null;
  if (isFinalWin(run)) {
    run.phase = 'victory';
    return;
  }
  advance(run);
}

export function continueEndless(run: RunState): void {
  assert(run.phase === 'victory', 'Not at victory');
  run.endless = true;
  advance(run);
}

function advance(run: RunState): void {
  run.table = null;
  run.tableIndex += 1;
  if (run.tableIndex > 2) {
    run.tableIndex = 0;
    run.ante += 1;
  }
  ensureBoss(run, run.ante);
  generateShop(run);
  run.phase = 'shop';
}

export function leaveShop(run: RunState): void {
  assert(run.phase === 'shop', 'Not in shop');
  assert(!run.shop?.openPack, 'Finish opening your pack first');
  run.shop = null;
  run.phase = 'select';
}
