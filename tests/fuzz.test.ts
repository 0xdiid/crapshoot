import { describe, expect, it } from 'vitest';
import {
  buy,
  cantBuy,
  cantFuse,
  cantPick,
  cantSellDie,
  cantReroll,
  cantUseConsumable,
  collectPayout,
  continueEndless,
  fuseDice,
  GameError,
  leaveShop,
  limits,
  moveCharm,
  newRun,
  nextFloat,
  pickPackOption,
  PROFILES,
  reroll,
  restockShop,
  scoreThrow,
  sellCharm,
  sellConsumable,
  sellDie,
  setInCup,
  skipPack,
  startTable,
  throwCup,
  toggleHold,
  useConsumable,
  type RunState,
  type ShopRef,
} from '../src/engine';
import { playRun, BOTS, summarize } from '../src/sim/simulate';

function checkInvariants(run: RunState) {
  const lim = limits(run);
  expect(run.money).toBeGreaterThanOrEqual(0);
  expect(run.box.length).toBeGreaterThanOrEqual(1);
  expect(run.cup.length).toBeGreaterThanOrEqual(1);
  expect(run.cup.length).toBeLessThanOrEqual(lim.cupSize);
  for (const u of run.cup) expect(run.box.some((d) => d.uid === u)).toBe(true);
  expect(new Set(run.cup).size).toBe(run.cup.length);
  expect(run.box.length).toBeLessThanOrEqual(lim.boxSize);
  expect(run.charms.length).toBeLessThanOrEqual(lim.charmSlots);
  expect(run.consumables.length).toBeLessThanOrEqual(lim.consumableSlots);
  for (const d of run.box) {
    expect(d.faces.length).toBe(6);
    expect(d.mods.length).toBeLessThanOrEqual(3);
  }
  const t = run.table;
  if (t) {
    expect(Number.isFinite(t.score)).toBe(true);
    expect(t.throwsLeft).toBeGreaterThanOrEqual(0);
    expect(t.rerollsLeft).toBeGreaterThanOrEqual(0);
    for (const d of t.dice ?? []) expect(d.face).toBeGreaterThanOrEqual(0);
  }
}

const r = (run: RunState, n: number) => Math.floor(nextFloat(run) * n);

function randomStep(run: RunState): boolean {
  const lim = limits(run);
  switch (run.phase) {
    case 'select': {
      if (nextFloat(run) < 0.2 && run.box.length > run.cup.length) {
        const out = run.box.find((d) => !run.cup.includes(d.uid));
        if (out && run.cup.length < lim.cupSize) setInCup(run, out.uid, true);
      }
      startTable(run);
      return true;
    }
    case 'table': {
      const t = run.table!;
      const roll = nextFloat(run);
      if (!t.dice) {
        if (roll < 0.1 && run.consumables.length) {
          const c = run.consumables[r(run, run.consumables.length)];
          const die = run.cup[r(run, run.cup.length)];
          if (!cantUseConsumable(run, c.uid, die)) useConsumable(run, c.uid, die);
        } else throwCup(run);
      } else if (roll < 0.1 && run.consumables.length) {
        const c = run.consumables[r(run, run.consumables.length)];
        const die = t.dice[r(run, t.dice.length)].id;
        if (!cantUseConsumable(run, c.uid, die)) useConsumable(run, c.uid, die);
      } else if (roll < 0.13 && run.charms.length > 1) {
        moveCharm(run, 0, run.charms.length - 1);
      } else if (roll < 0.55 && !cantReroll(run)) {
        for (const d of t.dice) toggleHold(run, d.id, nextFloat(run) < 0.4);
        if (!cantReroll(run)) reroll(run);
      } else scoreThrow(run);
      return true;
    }
    case 'payout':
      collectPayout(run);
      return true;
    case 'shop': {
      const s = run.shop!;
      if (s.openPack) {
        const i = r(run, s.openPack.options.length);
        const die = run.box[r(run, run.box.length)].uid;
        if (!cantPick(run, i, die)) pickPackOption(run, i, die);
        else skipPack(run);
        return true;
      }
      const x = nextFloat(run);
      if (x < 0.35) {
        const groups: ShopRef['group'][] = ['items', 'dice', 'packs', 'upgrade'];
        const group = groups[r(run, 4)];
        const ref = { group, index: group === 'items' ? r(run, 3) : group === 'packs' ? r(run, 2) : 0 };
        const item = group === 'upgrade' ? s.upgrade : s[group][ref.index];
        if (item && !cantBuy(run, item)) buy(run, ref);
      } else if (x < 0.42 && run.money >= s.restockCost) restockShop(run);
      else if (x < 0.5 && run.box.length >= 3) {
        const a = run.box[r(run, run.box.length)].uid;
        const b = run.box[r(run, run.box.length)].uid;
        if (!cantFuse(run, a, b)) fuseDice(run, a, b, nextFloat(run) < 0.5 ? 'keep' : 'feed');
      } else if (x < 0.55 && run.box.length > 0) {
        const d = run.box[r(run, run.box.length)].uid;
        if (!cantSellDie(run, d)) sellDie(run, d);
      } else if (x < 0.6 && run.charms.length) sellCharm(run, run.charms[0].uid);
      else if (x < 0.63 && run.consumables.length) sellConsumable(run, run.consumables[0].uid);
      else if (x < 0.7 && run.consumables.length) {
        const c = run.consumables[0];
        const die = run.box[r(run, run.box.length)].uid;
        if (!cantUseConsumable(run, c.uid, die)) useConsumable(run, c.uid, die);
      } else if (x < 0.75) {
        const d = run.box[r(run, run.box.length)].uid;
        if (run.cup.includes(d) && run.cup.length > 1) setInCup(run, d, false);
        else if (!run.cup.includes(d) && run.cup.length < lim.cupSize) setInCup(run, d, true);
      } else leaveShop(run);
      return true;
    }
    case 'victory':
      continueEndless(run);
      return true;
    default:
      return false;
  }
}

describe('fuzz', () => {
  it('random legal actions never break invariants', () => {
    for (let i = 0; i < 150; i++) {
      const run = newRun({ profileId: PROFILES[i % PROFILES.length].id, seed: `FZ${i}`, stake: i % 4 });
      run.money = 30;
      for (let step = 0; step < 3000; step++) {
        try {
          if (!randomStep(run)) break;
        } catch (e) {
          if (!(e instanceof GameError)) throw e;
        }
        checkInvariants(run);
        // Round-trip through JSON regularly to catch non-serializable state.
        if (step % 97 === 0) Object.assign(run, JSON.parse(JSON.stringify(run)));
      }
    }
  });
});

describe('balance', () => {
  it('skill beats luck', () => {
    const n = 40;
    const prog = (bot: keyof typeof BOTS) =>
      Number(summarize(Array.from({ length: n }, (_, i) => playRun('rookie', `B${i}`, BOTS[bot]))).avgProgress);
    const random = prog('random');
    const smart = prog('smart');
    expect(smart).toBeGreaterThan(random + 1);
  }, 60000);
});
