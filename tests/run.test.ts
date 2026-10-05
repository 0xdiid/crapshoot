import { describe, expect, it } from 'vitest';
import {
  anteTables,
  buy,
  collectPayout,
  cantBuy,
  fuseDice,
  leaveShop,
  limits,
  moveInCup,
  setInCup,
  swapCup,
  newRun,
  pickPackOption,
  PROFILES,
  restockShop,
  scoreThrow,
  sellCharm,
  startTable,
  throwCup,
  useConsumable,
  CONSUMABLES,
  type RunState,
} from '../src/engine';

function playUntilDone(run: RunState) {
  while (run.phase === 'table') {
    throwCup(run);
    scoreThrow(run);
  }
}

describe('new runs', () => {
  it('start every profile in a valid state', () => {
    for (const p of PROFILES) {
      const run = newRun({ profileId: p.id, seed: 'ABC' });
      expect(run.phase).toBe('select');
      expect(run.box.length).toBeGreaterThanOrEqual(4);
      expect(run.cup.length).toBe(run.box.length);
      expect(run.bossByAnte[1]).toBeTruthy();
    }
  });

  it('is deterministic for a seed', () => {
    const a = newRun({ profileId: 'rookie', seed: 'SAME' });
    const b = newRun({ profileId: 'rookie', seed: 'SAME' });
    startTable(a);
    startTable(b);
    const faces = (r: RunState) => throwCup(r).dice.map((d) => d.face);
    expect(faces(a)).toEqual(faces(b));
  });

  it('survives a JSON round trip mid-table', () => {
    const a = newRun({ profileId: 'hustler', seed: 'SAVE' });
    startTable(a);
    throwCup(a);
    const b = JSON.parse(JSON.stringify(a)) as RunState;
    expect(scoreThrow(b).total).toBe(scoreThrow(a).total);
    expect(throwCup(b).dice.map((d) => d.face)).toEqual(throwCup(a).dice.map((d) => d.face));
  });

  it('has escalating targets and a boss each ante', () => {
    const run = newRun({ profileId: 'rookie', seed: 'T' });
    const t1 = anteTables(run, 1);
    const t2 = anteTables(run, 2);
    expect(t1[0].target).toBe(200);
    expect(t1[1].target).toBe(300);
    expect(t1[0].throws).toBe(4);
    expect(t1[0].rerolls).toBe(5);
    expect(t2[0].target).toBeGreaterThan(t1[2].target / 2);
    expect(t1[2].boss).toBeTruthy();
    expect(anteTables(run, 8)[2].boss!.rules.length).toBe(2);
  });
});

describe('the loop', () => {
  it('goes table -> payout -> shop -> select', () => {
    const run = newRun({ profileId: 'rookie', seed: 'LOOP' });
    startTable(run);
    run.table!.target = 1;
    playUntilDone(run);
    expect(run.phase).toBe('payout');
    collectPayout(run);
    expect(run.phase).toBe('shop');
    expect(run.shop!.items.length).toBe(3);
    leaveShop(run);
    expect(run.phase).toBe('select');
    expect(run.tableIndex).toBe(1);
  });

  it('can play full tables without crashing', () => {
    for (let i = 0; i < 50; i++) {
      const run = newRun({ profileId: PROFILES[i % PROFILES.length].id, seed: `P${i}` });
      startTable(run);
      playUntilDone(run);
      expect(['payout', 'gameover']).toContain(run.phase);
    }
  });
});

describe('shop', () => {
  function shopRun() {
    const run = newRun({ profileId: 'rookie', seed: 'SHOP' });
    startTable(run);
    run.table!.target = 1;
    playUntilDone(run);
    collectPayout(run);
    run.money = 100;
    return run;
  }

  it('buys and sells charms', () => {
    const run = shopRun();
    const idx = run.shop!.items.findIndex((i) => i.kind === 'charm');
    if (idx >= 0) {
      buy(run, { group: 'items', index: idx });
      expect(run.charms.length).toBe(1);
      const before = run.money;
      sellCharm(run, run.charms[0].uid);
      expect(run.money).toBeGreaterThan(before);
    }
  });

  it('restocks cost more each time', () => {
    const run = shopRun();
    const c = run.shop!.restockCost;
    restockShop(run);
    expect(run.shop!.restockCost).toBe(c + 1);
  });

  it('opens packs and picks', () => {
    const run = shopRun();
    buy(run, { group: 'packs', index: 0 });
    const pack = run.shop!.openPack!;
    expect(pack.options.length).toBeGreaterThan(0);
    const opt = pack.options[0];
    const needsDie = opt.kind === 'consumable' && CONSUMABLES[opt.id].kind === 'token';
    pickPackOption(run, 0, needsDie ? run.box[0].uid : undefined);
    expect(run.shop!.openPack).toBeNull();
  });

  it('blocks buying with full slots', () => {
    const run = shopRun();
    run.money = 0;
    expect(cantBuy(run, run.shop!.items[0])).toBe('Not enough money');
  });

  it('fuses dice', () => {
    const run = shopRun();
    run.box[0].mods = ['gold'];
    run.box[1].mods = ['glass'];
    run.box[1].faceSet = 'loaded';
    run.box[1].faces = [2, 3, 4, 5, 6, 6];
    const n = run.box.length;
    const fused = fuseDice(run, run.box[0].uid, run.box[1].uid, 'feed');
    expect(run.box.length).toBe(n - 1);
    expect(fused.mods).toEqual(['gold', 'glass']);
    expect(fused.faceSet).toBe('loaded');
  });

  it('uses cocktails and tokens', () => {
    const run = shopRun();
    run.consumables.push({ uid: 'k1', id: 'house_red' }, { uid: 'k2', id: 'gold_leaf' });
    useConsumable(run, 'k1');
    expect(run.levels.fullhouse).toBe(2);
    useConsumable(run, 'k2', run.box[2].uid);
    expect(run.box[2].mods).toContain('gold');
  });

  it('moves dice between cup and bench and reorders the cup', () => {
    const run = shopRun();
    run.box.push({ uid: 'extra', faceSet: 'loaded', faces: [2, 3, 4, 5, 6, 6], mods: [], hotChips: 0 });
    const [a, b] = run.cup;
    swapCup(run, a, 'extra');
    expect(run.cup[0]).toBe('extra');
    expect(run.cup).not.toContain(a);
    moveInCup(run, 'extra', 3);
    expect(run.cup[3]).toBe('extra');
    setInCup(run, b, false);
    expect(run.cup).not.toContain(b);
    setInCup(run, a, true);
    expect(run.cup).toContain(a);
  });

  it('photocopy duplicates a die', () => {
    const run = shopRun();
    run.consumables.push({ uid: 'k1', id: 'photocopy' });
    const n = run.box.length;
    useConsumable(run, 'k1', run.box[0].uid);
    expect(run.box.length).toBe(n + 1);
    expect(run.stats.dupes).toBe(1);
  });

  it('upgrades change limits', () => {
    const run = shopRun();
    run.upgrades.push('extra_throw', 'charm_rack', 'big_cup');
    expect(limits(run).throws).toBe(5);
    expect(limits(run).cupSize).toBe(6);
    expect(limits(run).charmSlots).toBe(6);
  });
});
