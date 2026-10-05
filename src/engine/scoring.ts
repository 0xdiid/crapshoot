import type { AfterScoreCtx, ScoreCtx, ScoredDie, Scorer, ThrowCtx } from './context';
import { BOSSES } from './data/bosses';
import { CHARMS } from './data/charms';
import type { TrickDef } from './data/consumables';
import { HAND_ORDER, HANDS, containedHands, findHands, handValues, type HandRules } from './data/hands';
import { nextFloat, pick, randInt } from './rng';
import { finishTable, type TableEndNote } from './run';
import { assert, cloneDie, ensureMinDice, getDie, levelUp, noteDupe, passives } from './state';
import type { Die, Face, HandId, RunState, TableDie, TableState } from './types';
import { WILD } from './types';

// ---------- Report types ----------

export type StepSrc = 'hand' | 'die' | 'idle' | 'charm' | 'boss';

export interface ScoreStep {
  src: StepSrc;
  ref?: string; // table die id or charm uid
  label?: string;
  chips?: number;
  mult?: number;
  xmult?: number;
  money?: number;
  rerolls?: number;
  chipsTotal: number;
  multTotal: number;
}

export interface ScoreResult {
  steps: ScoreStep[];
  chips: number;
  mult: number;
  total: number;
  money: number;
  rerolls: number;
  luckyHits: number;
  voided: string | null;
}

// ---------- Table dice ----------

function facesFor(t: TableState, d: Die): Face[] {
  return t.bossRules.includes('house_dice') ? [1, 2, 3, 4, 5, 6] : d.faces;
}

function rollFace(run: RunState, t: TableState, d: Die): Face {
  const f = pick(run, facesFor(t, d));
  return f === 1 && passives(run).onesWild ? WILD : f;
}

function newTableDie(t: TableState, uid: string, face: Face, temp: boolean): TableDie {
  t.nextDieId += 1;
  return { id: `x${t.nextDieId}`, uid, face, held: false, temp };
}

function debuffs(t: TableState): number[] {
  return t.bossRules.flatMap((r) => BOSSES[r]?.debuff ?? []);
}

function handRules(run: RunState): HandRules {
  const p = passives(run);
  return { shortcut: p.shortcut, fourFingers: p.fourFingers };
}

export function canThrow(run: RunState): string | null {
  const t = run.table;
  if (run.phase !== 'table' || !t) return 'Not at a table';
  if (t.finished) return 'Table is over';
  if (t.dice) return 'Score or reroll first';
  if (t.throwsLeft <= 0) return 'No Throws left';
  return null;
}

export interface AddedDie {
  id: string;
  from: string; // table die id it copied, or ''
  reason: 'twin' | 'charm';
  ref?: string; // charm uid
}

export interface ThrowReport {
  dice: TableDie[];
  added: AddedDie[];
  notes: { ref: string; text: string }[];
}

/** Throws every die in the Cup. Twins split, then charms may add dice. */
export function throwCup(run: RunState): ThrowReport {
  const why = canThrow(run);
  assert(!why, why ?? '');
  const t = run.table!;
  const dice: TableDie[] = [];
  const added: AddedDie[] = [];
  const notes: ThrowReport['notes'] = [];
  const cup = run.cup.slice(0, t.cupSize);
  for (const uid of cup) {
    const d = getDie(run, uid);
    if (!d) continue;
    const td = newTableDie(t, uid, rollFace(run, t, d), false);
    dice.push(td);
    for (let i = 0; i < d.mods.filter((m) => m === 'twin').length; i++) {
      const copy = newTableDie(t, uid, rollFace(run, t, d), true);
      dice.push(copy);
      added.push({ id: copy.id, from: td.id, reason: 'twin' });
    }
  }
  t.dice = dice;
  t.rerollsThisThrow = 0;
  noteDupe(run, added.length);

  const ctx: ThrowCtx = {
    run,
    table: t,
    dice,
    addDie(fromUid, face) {
      const copy = newTableDie(t, fromUid, face, true);
      copy.held = true;
      dice.push(copy);
      return copy;
    },
  };
  for (const c of run.charms) {
    const def = CHARMS[c.id];
    if (!def?.onThrow) continue;
    const before = dice.length;
    const note = def.onThrow(ctx, c);
    for (const nd of dice.slice(before)) {
      const from = dice.find((d) => d.uid === nd.uid && d.id !== nd.id);
      added.push({ id: nd.id, from: from?.id ?? '', reason: 'charm', ref: c.uid });
    }
    noteDupe(run, dice.length - before);
    if (note) notes.push({ ref: c.uid, text: note });
  }
  return { dice: [...dice], added, notes };
}

export function toggleHold(run: RunState, id: string, held?: boolean): void {
  const t = run.table;
  assert(t?.dice && !t.finished, 'Nothing to hold');
  const d = t.dice.find((x) => x.id === id);
  assert(d, 'No such die');
  d.held = held ?? !d.held;
}

export function cantReroll(run: RunState): string | null {
  const t = run.table;
  if (run.phase !== 'table' || !t || t.finished) return 'Not now';
  if (!t.dice) return 'Throw first';
  if (t.rerollsLeft <= 0) return 'No Rerolls left';
  if (t.dice.every((d) => d.held)) return 'Every die is held';
  if (t.bossRules.includes('taxman') && run.money < 1) return 'The Taxman wants $1';
  return null;
}

export interface RerollReport {
  rerolled: string[];
  before: Record<string, Face>;
  tilted: string | null;
  money: number;
}

export function reroll(run: RunState): RerollReport {
  const why = cantReroll(run);
  assert(!why, why ?? '');
  const t = run.table!;
  const dice = t.dice!;
  const rep: RerollReport = { rerolled: [], before: {}, tilted: null, money: 0 };
  if (t.bossRules.includes('taxman')) {
    run.money -= 1;
    rep.money = -1;
  }
  const targets = dice.filter((d) => !d.held);
  const held = dice.filter((d) => d.held);
  if (t.bossRules.includes('tilt') && held.length) {
    const d = held[randInt(run, held.length)];
    rep.tilted = d.id;
    targets.push(d);
  }
  for (const td of targets) {
    const d = getDie(run, td.uid);
    if (!d) continue;
    rep.before[td.id] = td.face;
    td.face = rollFace(run, t, d);
    rep.rerolled.push(td.id);
  }
  t.rerollsLeft -= 1;
  t.rerollsUsed += 1;
  t.rerollsThisThrow += 1;
  run.stats.rerolls += 1;
  for (const c of run.charms) CHARMS[c.id]?.onReroll?.(run, t, c);
  return rep;
}

// ---------- Resolution ----------

/** Faces after Mirror dice copy the crowd. Wild faces stay WILD. */
export function mirroredFaces(run: RunState, dice: TableDie[]): { faces: Face[]; mirrored: boolean[] } {
  const isMirror = dice.map((d) => !!getDie(run, d.uid)?.mods.includes('mirror'));
  const counts = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((d, i) => {
    if (!isMirror[i] && d.face !== WILD) counts[d.face] += 1;
  });
  let best = 0;
  for (let f = 6; f >= 1; f--) if (counts[f] > (counts[best] ?? 0)) best = f;
  return {
    faces: dice.map((d, i) => (isMirror[i] && best ? best : d.face)),
    mirrored: isMirror.map((m) => m && best > 0),
  };
}

export function voidReason(t: TableState, hand: HandId): string | null {
  if (t.bossRules.includes('eye') && (t.handsScored[hand] ?? 0) > 0) return 'Eye in the Sky';
  if (t.bossRules.includes('iron_hand') && t.lockedHand && t.lockedHand !== hand) return 'The Iron Hand';
  return null;
}

export interface HandOption {
  hand: HandId;
  faces: number[]; // resolved, one per table die
  handIdx: number[]; // dice that make the hand
  lit: number[]; // dice that will score (more than handIdx with Team Player)
  preview: number;
  voided: string | null;
}

function buildCtx(
  run: RunState,
  t: TableState,
  hand: HandId,
  faces: number[],
  scoringIdx: number[],
  dry: boolean,
): ScoreCtx {
  const dice = t.dice!;
  const { mirrored } = mirroredFaces(run, dice);
  const debuffed = debuffs(t);
  const all: ScoredDie[] = dice.map((d, i) => ({
    id: d.id,
    die: getDie(run, d.uid)!,
    face: faces[i],
    wild: d.face === WILD && !mirrored[i],
    mirrored: mirrored[i],
    temp: d.temp,
    debuffed: debuffed.includes(faces[i]),
  }));
  const idxs = passives(run).allScore ? all.map((_, i) => i) : [...scoringIdx].sort((a, b) => a - b);
  const scoring = idxs.map((i) => all[i]);
  const idle = all.filter((_, i) => !idxs.includes(i));
  return {
    run,
    table: t,
    hand,
    contains: containedHands(
      scoringIdx.map((i) => faces[i]),
      handRules(run),
    ),
    dice: all,
    scoring,
    idle,
    throwIndex: t.throwsUsed,
    isFirstThrow: t.throwsUsed === 0,
    isLastThrow: t.throwsLeft === 1,
    rerollsThisThrow: t.rerollsThisThrow,
    cupSize: t.cupSize,
    dry,
  };
}

export function computeScore(ctx: ScoreCtx): ScoreResult {
  const { run, table } = ctx;
  const steps: ScoreStep[] = [];
  const probMul = passives(run).probMul;
  let chips = 0;
  let mult = 0;
  let money = 0;
  let rerolls = 0;
  let luckyHits = 0;
  let src: StepSrc = 'hand';
  let ref: string | undefined;
  let label: string | undefined;

  const push = (s: Partial<ScoreStep>) =>
    steps.push({ src, ref, label, ...s, chipsTotal: chips, multTotal: mult } as ScoreStep);

  const s: Scorer = {
    chips(n) {
      if (!n) return;
      chips += n;
      push({ chips: n });
    },
    mult(n) {
      if (!n) return;
      mult += n;
      push({ mult: n });
    },
    xmult(x) {
      if (x === 1) return;
      mult *= x;
      push({ xmult: x });
    },
    money(n) {
      if (!n) return;
      money += n;
      push({ money: n });
    },
    rerolls(n) {
      if (!n) return;
      rerolls += n;
      push({ rerolls: n });
    },
    roll(oneIn) {
      if (ctx.dry) return false;
      return nextFloat(run) < Math.min(1, probMul / oneIn);
    },
  };

  const base = handValues(ctx.hand, run.levels[ctx.hand]);
  if (table.bossRules.includes('shaver')) {
    base.chips = Math.floor(base.chips / 2);
    base.mult = Math.max(1, Math.floor(base.mult / 2));
  }
  chips = base.chips;
  mult = base.mult;
  steps.push({
    src: 'hand',
    label: HANDS[ctx.hand].name,
    chips: base.chips,
    mult: base.mult,
    chipsTotal: chips,
    multTotal: mult,
  });

  ctx.scoring.forEach((d, index) => {
    src = 'die';
    ref = d.id;
    label = undefined;
    if (d.debuffed) {
      label = 'debuffed';
      push({});
      return;
    }
    let reps = 1 + d.die.mods.filter((m) => m === 'echo').length;
    for (const c of run.charms) reps += CHARMS[c.id]?.retrigger?.(ctx, d, index, c) ?? 0;
    const heavy = d.die.mods.filter((m) => m === 'heavy').length;
    for (let r = 0; r < reps; r++) {
      src = 'die';
      ref = d.id;
      label = r > 0 ? 'again' : undefined;
      s.chips(d.face * (1 + 4 * heavy));
      for (const m of d.die.mods) {
        label = m;
        switch (m) {
          case 'hot':
            s.chips(d.die.hotChips);
            break;
          case 'ruby':
            s.mult(d.face);
            break;
          case 'lucky':
            if (s.roll(4)) {
              s.mult(12);
              luckyHits += 1;
            }
            if (s.roll(12)) {
              s.money(5);
              luckyHits += 1;
            }
            break;
          case 'gold':
            s.money(1);
            break;
          case 'glass':
            s.xmult(2);
            break;
          case 'spinner':
            s.rerolls(1);
            break;
        }
      }
      src = 'charm';
      for (const c of run.charms) {
        const def = CHARMS[c.id];
        if (!def?.onDie) continue;
        ref = c.uid;
        label = d.id;
        def.onDie(ctx, d, s, c);
      }
    }
  });

  for (const d of ctx.idle) {
    if (d.debuffed) continue;
    src = 'idle';
    ref = d.id;
    label = 'steel';
    const reps = 1 + d.die.mods.filter((m) => m === 'echo').length;
    for (let r = 0; r < reps; r++) for (const m of d.die.mods) if (m === 'steel') s.xmult(1.5);
    src = 'charm';
    for (const c of run.charms) {
      const def = CHARMS[c.id];
      if (!def?.onIdle) continue;
      ref = c.uid;
      label = d.id;
      def.onIdle(ctx, d, s, c);
    }
  }

  src = 'charm';
  label = undefined;
  for (const c of run.charms) {
    const def = CHARMS[c.id];
    if (!def?.score) continue;
    ref = c.uid;
    def.score(ctx, s, c);
  }

  let total = Math.floor(chips * mult);
  const voided = voidReason(table, ctx.hand);
  if (voided) {
    src = 'boss';
    ref = undefined;
    label = voided;
    total = 0;
    push({});
  }
  return { steps, chips, mult, total, money, rerolls, luckyHits, voided };
}

const MAX_WILD_COMBOS = 3;

/** Every hand you could score with the dice on the felt, best first. */
export function handOptions(run: RunState): HandOption[] {
  const t = run.table;
  if (!t?.dice?.length) return [];
  const { faces } = mirroredFaces(run, t.dice);
  const wilds = faces.map((f, i) => (f === WILD ? i : -1)).filter((i) => i >= 0);
  const free = wilds.slice(0, MAX_WILD_COMBOS);
  const assignments: number[][] = [];
  const combos = Math.pow(6, free.length);
  for (let n = 0; n < combos; n++) {
    const a = [...faces];
    let k = n;
    for (const i of free) {
      a[i] = (k % 6) + 1;
      k = Math.floor(k / 6);
    }
    for (const i of wilds.slice(MAX_WILD_COMBOS)) a[i] = a[free[0]];
    assignments.push(a);
  }
  const rules = handRules(run);
  const best = new Map<HandId, HandOption>();
  for (const a of assignments) {
    const hands = findHands(a, rules);
    for (const [hand, idx] of Object.entries(hands) as [HandId, number[]][]) {
      const ctx = buildCtx(run, t, hand, a, idx, true);
      const sc = computeScore(ctx);
      const prev = best.get(hand);
      if (!prev || sc.total > prev.preview)
        best.set(hand, {
          hand,
          faces: a,
          handIdx: idx,
          lit: ctx.scoring.map((d) => t.dice!.findIndex((x) => x.id === d.id)),
          preview: sc.total,
          voided: sc.voided,
        });
    }
  }
  return [...best.values()].sort(
    (x, y) => y.preview - x.preview || HAND_ORDER.indexOf(y.hand) - HAND_ORDER.indexOf(x.hand),
  );
}

// ---------- Scoring a throw ----------

export interface DieOutcome {
  id: string;
  uid: string;
  raw: Face;
  face: number;
  wild: boolean;
  mirrored: boolean;
  temp: boolean;
  debuffed: boolean;
  scoring: boolean;
}

export interface ScoreReport {
  hand: HandId;
  dice: DieOutcome[];
  steps: ScoreStep[];
  chips: number;
  mult: number;
  total: number;
  voided: string | null;
  scoreBefore: number;
  scoreAfter: number;
  money: number;
  rerollsGained: number;
  shattered: string[]; // box die uids
  cloned: string[]; // new box die uids
  levelChanges: { hand: HandId; from: number; to: number; ref?: string }[];
  notes: { ref: string; text: string }[];
  tableResult: 'won' | 'lost' | null;
  tableEndNotes: TableEndNote[];
}

export function cantScore(run: RunState): string | null {
  const t = run.table;
  if (run.phase !== 'table' || !t || t.finished) return 'Not now';
  if (!t.dice) return 'Throw first';
  return null;
}

export function scoreThrow(run: RunState, hand?: HandId): ScoreReport {
  const why = cantScore(run);
  assert(!why, why ?? '');
  const t = run.table!;
  const options = handOptions(run);
  const opt = (hand && options.find((o) => o.hand === hand)) || options[0];
  assert(opt, 'No hand to score');
  const ctx = buildCtx(run, t, opt.hand, opt.faces, opt.handIdx, false);
  const sc = computeScore(ctx);
  const moneyBefore = run.money;
  const scoreBefore = t.score;
  const scoringIds = new Set(ctx.scoring.map((d) => d.id));

  t.score += sc.total;
  run.money += sc.money;
  t.rerollsLeft += sc.rerolls;
  for (let i = 0; i < sc.luckyHits; i++) for (const c of run.charms) CHARMS[c.id]?.onLucky?.(run, c);

  const levelChanges: ScoreReport['levelChanges'] = [];
  const notes: ScoreReport['notes'] = [];
  const shattered: string[] = [];
  const cloned: string[] = [];
  const probMul = passives(run).probMul;

  for (const d of ctx.scoring) {
    if (d.temp || d.debuffed) continue;
    const reps = 1 + d.die.mods.filter((m) => m === 'echo').length;
    d.die.hotChips += 4 * reps * d.die.mods.filter((m) => m === 'hot').length;
  }
  for (const d of ctx.scoring) {
    if (d.temp || d.debuffed || !d.die.mods.includes('glass') || shattered.includes(d.die.uid)) continue;
    if (nextFloat(run) < Math.min(1, probMul / 6)) shattered.push(d.die.uid);
  }
  for (let i = 0; i < shattered.length; i++) for (const c of run.charms) CHARMS[c.id]?.onShatter?.(run, c);

  if (t.bossRules.includes('arm') && run.levels[opt.hand] > 1) {
    levelChanges.push({ hand: opt.hand, from: run.levels[opt.hand], to: run.levels[opt.hand] - 1 });
    run.levels[opt.hand] -= 1;
  }

  t.handsScored[opt.hand] = (t.handsScored[opt.hand] ?? 0) + 1;
  if (!sc.voided) t.lockedHand ??= opt.hand;
  run.stats.hands[opt.hand] += 1;
  run.stats.throws += 1;

  for (const c of run.charms) {
    const def = CHARMS[c.id];
    if (!def?.afterScore) continue;
    const a: AfterScoreCtx = {
      run,
      table: t,
      hand: opt.hand,
      contains: ctx.contains,
      scoring: ctx.scoring,
      total: sc.total,
      rerollsThisThrow: t.rerollsThisThrow,
      roll: (oneIn) => nextFloat(run) < Math.min(1, probMul / oneIn),
      levelUp(h) {
        const from = run.levels[h];
        levelUp(run, h);
        levelChanges.push({ hand: h, from, to: run.levels[h], ref: c.uid });
      },
      clone(die) {
        if (shattered.includes(die.uid)) return false;
        const copy = cloneDie(run, die);
        if (copy) cloned.push(copy.uid);
        return !!copy;
      },
    };
    const note = def.afterScore(a, c);
    if (note) notes.push({ ref: c.uid, text: note });
  }
  run.charms = run.charms.filter((c) => !c.data.destroyed);

  if (shattered.length) {
    run.box = run.box.filter((d) => !shattered.includes(d.uid));
    ensureMinDice(run);
  }

  const outcomes: DieOutcome[] = t.dice!.map((d, i) => {
    const sd = ctx.dice[i];
    return {
      id: d.id,
      uid: d.uid,
      raw: d.face,
      face: sd.face,
      wild: sd.wild,
      mirrored: sd.mirrored,
      temp: d.temp,
      debuffed: sd.debuffed,
      scoring: scoringIds.has(d.id),
    };
  });

  t.history.push({ hand: opt.hand, faces: opt.faces, score: sc.total });
  t.bestThrow = Math.max(t.bestThrow, sc.total);
  run.stats.bestThrow = Math.max(run.stats.bestThrow, sc.total);
  t.throwsLeft -= 1;
  t.throwsUsed += 1;
  t.dice = null;
  t.rerollsThisThrow = 0;

  const report: ScoreReport = {
    hand: opt.hand,
    dice: outcomes,
    steps: sc.steps,
    chips: sc.chips,
    mult: sc.mult,
    total: sc.total,
    voided: sc.voided,
    scoreBefore,
    scoreAfter: t.score,
    money: run.money - moneyBefore,
    rerollsGained: sc.rerolls,
    shattered,
    cloned,
    levelChanges,
    notes,
    tableResult: null,
    tableEndNotes: [],
  };
  if (t.score >= t.target) report.tableResult = 'won';
  else if (t.throwsLeft <= 0) report.tableResult = 'lost';
  if (report.tableResult) report.tableEndNotes = finishTable(run, report.tableResult);
  return report;
}

// ---------- Tricks ----------

export function cantUseTrick(run: RunState, def: TrickDef, dieId?: string): string | null {
  const t = run.table;
  if (run.phase !== 'table' || !t || t.finished) return 'Only at a table';
  if (!def.targeted) return null;
  if (!t.dice) return 'Throw first';
  const td = t.dice.find((d) => d.id === dieId);
  if (!td) return 'Pick a thrown die';
  if (def.effect === 'double_down') return null;
  if (td.face === WILD) return 'Wild faces are already anything';
  if (getDie(run, td.uid)?.mods.includes('mirror')) return 'Mirror dice copy the others';
  if (def.effect === 'nudge_up' && td.face >= 6) return 'Already a 6';
  if (def.effect === 'nudge_down' && td.face <= 1) return 'Already a 1';
  return null;
}

export function applyTrick(run: RunState, def: TrickDef, dieId?: string): TableDie | null {
  const why = cantUseTrick(run, def, dieId);
  assert(!why, why ?? '');
  const t = run.table!;
  const td = t.dice?.find((d) => d.id === dieId);
  switch (def.effect) {
    case 'nudge_up':
      td!.face += 1;
      break;
    case 'nudge_down':
      td!.face -= 1;
      break;
    case 'flip':
      td!.face = 7 - td!.face;
      break;
    case 'double_down': {
      const { faces } = mirroredFaces(run, t.dice!);
      const copy = newTableDie(t, td!.uid, faces[t.dice!.indexOf(td!)], true);
      copy.held = true;
      t.dice!.splice(t.dice!.indexOf(td!) + 1, 0, copy);
      noteDupe(run, 1);
      return copy;
    }
    case 'second_wind':
      t.rerollsLeft += 2;
      break;
    case 'overtime':
      t.throwsLeft += 1;
      break;
  }
  return null;
}
