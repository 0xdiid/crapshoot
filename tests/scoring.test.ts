import { describe, expect, it } from 'vitest';
import {
  cantReroll,
  handOptions,
  newRun,
  reroll,
  scoreThrow,
  startTable,
  throwCup,
  toggleHold,
  useConsumable,
  WILD,
} from '../src/engine';
import { fixedDie, tableWith, thrown } from './helpers';

describe('scoring', () => {
  it('scores a Pair as base plus the paired pips, times Mult', () => {
    const { run } = thrown([3, 3, 1, 2, 6]);
    const r = scoreThrow(run);
    expect(r.hand).toBe('pair');
    expect(r.total).toBe((10 + 6) * 2);
    expect(r.dice.filter((d) => d.scoring).map((d) => d.face)).toEqual([3, 3]);
  });

  it('picks the best hand by default and lets you pick another', () => {
    const { run } = thrown([5, 5, 5, 2, 2]);
    const opts = handOptions(run);
    expect(opts[0].hand).toBe('fullhouse');
    expect(opts[0].preview).toBe((35 + 19) * 4);
    expect(scoreThrow(run, 'pair').hand).toBe('pair');
  });

  it('levels raise Chips and Mult', () => {
    const { run } = thrown([3, 3, 1, 2, 6]);
    run.levels.pair = 3;
    expect(scoreThrow(run).total).toBe((10 + 30 + 6) * 4);
  });

  it('applies dice mods on scoring and idle dice', () => {
    const { run } = thrown([4, 4, 1, 2, 6], { mods: [['ruby'], ['heavy'], ['steel'], [], []] });
    const r = scoreThrow(run);
    // Pair: 10 + 4 + 4*5 chips, 2 + 4 (ruby) mult, x1.5 from idle steel
    expect(r.chips).toBe(34);
    expect(r.mult).toBe(6 * 1.5);
    expect(r.total).toBe(Math.floor(34 * 9));
  });

  it('echo triggers a die twice, gold pays, spinner refunds a reroll', () => {
    const { run, t } = thrown([4, 4, 1, 2, 6], { mods: [['echo', 'gold'], ['spinner'], [], [], []] });
    const before = run.money;
    const left = t.rerollsLeft;
    const r = scoreThrow(run);
    expect(r.chips).toBe(10 + 4 + 4 + 4);
    expect(run.money - before).toBe(2);
    expect(r.rerollsGained).toBe(1);
    expect(t.rerollsLeft).toBe(left + 1);
  });

  it('mirror dice copy the most common face', () => {
    const { run } = thrown([4, 4, 1, 2, 3], { mods: [[], [], [], [], ['mirror']] });
    expect(handOptions(run)[0].hand).toBe('three');
  });

  it('wild faces become whatever makes the best hand', () => {
    const { run } = tableWith([5, 5, 5, 2, 2]);
    run.box[0].faces = [WILD, WILD, WILD, WILD, WILD, WILD];
    throwCup(run);
    expect(handOptions(run)[0].hand).toBe('fullhouse');
    const { run: r2 } = tableWith([6, 6, 6, 6, 1]);
    r2.box[4].faces = Array(6).fill(WILD);
    throwCup(r2);
    expect(handOptions(r2)[0].hand).toBe('five');
  });

  it('twin dice split in two', () => {
    const { run, t } = thrown([1, 2, 3, 4, 5], { mods: [['twin'], [], [], [], []] });
    expect(t.dice!.length).toBe(6);
    expect(t.dice!.filter((d) => d.temp).length).toBe(1);
    expect(run.stats.dupes).toBe(1);
  });

  it('rerolls leave held dice alone and spend the pool', () => {
    const run = newRun({ profileId: 'rookie', seed: 'HOLD' });
    const t = startTable(run);
    throwCup(run);
    const keep = t.dice![0];
    const face = keep.face;
    toggleHold(run, keep.id);
    const left = t.rerollsLeft;
    reroll(run);
    expect(keep.face).toBe(face);
    expect(t.rerollsLeft).toBe(left - 1);
    for (const d of t.dice!) toggleHold(run, d.id, true);
    expect(cantReroll(run)).toBe('Every die is held');
  });

  it('wins when the target is reached and loses when throws run out', () => {
    const { run } = thrown([6, 6, 6, 6, 6], { target: 100 });
    expect(scoreThrow(run).tableResult).toBe('won');
    expect(run.phase).toBe('payout');
    const { run: r2, t } = tableWith([1, 2, 4, 5, 6]);
    t.throwsLeft = 1;
    throwCup(r2);
    expect(scoreThrow(r2).tableResult).toBe('lost');
    expect(r2.phase).toBe('gameover');
  });

  it('bigger cups make six-dice hands', () => {
    const { run } = thrown([2, 2, 2, 2, 2, 2]);
    expect(handOptions(run)[0].hand).toBe('six');
  });
});

describe('charms', () => {
  it('flat and conditional charms', () => {
    const { run } = thrown([3, 3, 1, 2, 6], { charms: ['lucky_penny', 'pair_a_dice', 'the_family'] });
    expect(scoreThrow(run).total).toBe((10 + 6) * (2 + 4 + 8));
  });

  it('per-die and retrigger charms', () => {
    const { run } = thrown([6, 6, 1, 2, 4], { charms: ['six_shooter', 'photo_finish'] });
    // Pair of 6s: first 6 triggers twice.
    const r = scoreThrow(run);
    expect(r.chips).toBe(10 + 6 * 3);
    expect(r.mult).toBe(2 + 4 * 3);
  });

  it('Team Player scores every die', () => {
    const { run } = thrown([3, 3, 1, 2, 6], { charms: ['team_player'] });
    expect(scoreThrow(run).chips).toBe(10 + 3 + 3 + 1 + 2 + 6);
  });

  it('Split Decision turns a lone Pair into Three of a Kind', () => {
    const { run, t } = thrown([3, 3, 1, 2, 6], { charms: ['split_decision'] });
    expect(t.dice!.length).toBe(6);
    expect(handOptions(run)[0].hand).toBe('three');
  });

  it('Mitosis clones a die on Four of a Kind', () => {
    const { run } = thrown([5, 5, 5, 5, 1], { charms: ['mitosis'] });
    const n = run.box.length;
    const r = scoreThrow(run);
    expect(r.cloned.length).toBe(1);
    expect(run.box.length).toBe(n + 1);
  });

  it('Light Pockets pays for empty Cup slots', () => {
    const { run, t } = tableWith([3, 3, 1], { charms: ['light_pockets'] });
    t.cupSize = 5;
    throwCup(run);
    expect(scoreThrow(run).total).toBe((10 + 6) * 2 * 4);
  });

  it('scaling charms remember', () => {
    const { run, t } = thrown([3, 3, 1, 2, 6], { charms: ['green_thumb'] });
    scoreThrow(run);
    throwCup(run);
    expect(scoreThrow(run).mult).toBe(3);
    expect(t.throwsUsed).toBe(2);
  });
});

describe('bosses', () => {
  it('Eye in the Sky voids a repeated hand', () => {
    const { run, t } = thrown([3, 3, 1, 2, 6]);
    t.bossRules = ['eye'];
    expect(scoreThrow(run).total).toBeGreaterThan(0);
    throwCup(run);
    expect(scoreThrow(run, 'pair').total).toBe(0);
  });

  it('The Scorpion debuffs 1s and 2s', () => {
    const { run, t } = thrown([2, 2, 1, 4, 6]);
    t.bossRules = ['scorpion'];
    const r = handOptions(run).find((o) => o.hand === 'pair')!;
    expect(r.preview).toBe(10 * 2);
  });

  it('The Arm lowers the scored hand', () => {
    const { run, t } = thrown([3, 3, 1, 2, 6]);
    t.bossRules = ['arm'];
    run.levels.pair = 3;
    scoreThrow(run);
    expect(run.levels.pair).toBe(2);
  });
});

describe('tricks', () => {
  it('nudge, flip and double down', () => {
    const { run, t } = thrown([3, 3, 1, 2, 6]);
    run.consumables.push({ uid: 'a', id: 'nudge_up' }, { uid: 'b', id: 'flip' }, { uid: 'c', id: 'double_down' });
    useConsumable(run, 'a', t.dice![3].id);
    expect(t.dice![3].face).toBe(3);
    useConsumable(run, 'b', t.dice![2].id);
    expect(t.dice![2].face).toBe(6);
    useConsumable(run, 'c', t.dice![4].id);
    expect(t.dice!.length).toBe(6);
    expect(handOptions(run)[0].hand).toBe('twotrips');
  });

  it('untargeted tricks add throws and rerolls', () => {
    const { run, t } = tableWith([1, 2, 3, 4, 5]);
    run.consumables.push({ uid: 'a', id: 'overtime' }, { uid: 'b', id: 'second_wind' });
    const th = t.throwsLeft;
    const rr = t.rerollsLeft;
    useConsumable(run, 'a');
    useConsumable(run, 'b');
    expect(t.throwsLeft).toBe(th + 1);
    expect(t.rerollsLeft).toBe(rr + 2);
  });
});

describe('fixture sanity', () => {
  it('fixedDie always shows its value', () => {
    const run = newRun({ profileId: 'rookie', seed: 'F' });
    expect(fixedDie(run, 4).faces.every((f) => f === 4)).toBe(true);
  });
});
