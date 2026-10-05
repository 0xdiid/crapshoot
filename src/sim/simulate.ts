import {
  ANTE_TARGETS,
  BASE_LIMITS,
  collectPayout,
  leaveShop,
  newRun,
  PROFILES,
  scoreThrow,
  startTable,
  throwCup,
  type HandId,
  type RunState,
} from '../engine';
import { playThrow, shop, useComps, type Bot } from './bot';

export interface RunResult {
  ante: number;
  tableIndex: number;
  won: boolean;
  tables: {
    ante: number;
    idx: number;
    throws: number;
    rerolls: number;
    won: boolean;
    ratio: number;
  }[];
  charms: string[];
  hands: Partial<Record<HandId, number>>;
  money: number;
}

export function playRun(profileId: string, seed: string, bot: Bot, stake = 0): RunResult {
  const run: RunState = newRun({ profileId, seed, stake });
  const tables: RunResult['tables'] = [];
  let won = false;
  for (let guard = 0; guard < 10000; guard++) {
    if (run.phase === 'select') {
      startTable(run);
      if (bot.shop === 'smart') useComps(run);
    } else if (run.phase === 'table') {
      const t = run.table!;
      throwCup(run);
      playThrow(run, bot);
      scoreThrow(run);
      if (run.phase !== 'table') {
        tables.push({
          ante: run.ante,
          idx: run.tableIndex,
          throws: t.throwsUsed,
          rerolls: t.rerollsUsed,
          won: t.finished === 'won',
          ratio: t.score / t.target,
        });
      }
    } else if (run.phase === 'payout') collectPayout(run);
    else if (run.phase === 'shop') {
      shop(run, bot);
      if (run.shop?.openPack) run.shop.openPack = null;
      leaveShop(run);
    } else if (run.phase === 'victory') {
      won = true;
      break;
    } else break;
  }
  return {
    ante: run.ante,
    tableIndex: run.tableIndex,
    won,
    tables,
    charms: run.charms.map((c) => c.id),
    hands: run.stats.hands,
    money: run.money,
  };
}

export const BOTS: Record<string, Bot> = {
  random: { name: 'random', hold: 'random', shop: 'random' },
  basic: { name: 'basic', hold: 'basic', shop: 'random' },
  smart: { name: 'smart', hold: 'smart', shop: 'smart' },
  noshop: { name: 'smart-noshop', hold: 'smart', shop: 'none' },
};

export function summarize(results: RunResult[]) {
  const n = results.length;
  const progress = (r: RunResult) => r.ante + r.tableIndex / 3 + (r.won ? 1 : 0);
  const avg = results.reduce((s, r) => s + progress(r), 0) / n;
  const reach = (a: number) => results.filter((r) => r.ante >= a || r.won).length / n;
  const tables = results.flatMap((r) => r.tables);
  const wonTables = tables.filter((t) => t.won);
  const avgThrows = wonTables.reduce((s, t) => s + t.throws, 0) / Math.max(1, wonTables.length);
  const rerolls = tables.reduce((s, t) => s + t.rerolls, 0) / Math.max(1, tables.length);
  return {
    avgProgress: avg.toFixed(2),
    'A2%': (reach(2) * 100).toFixed(0),
    'A3%': (reach(3) * 100).toFixed(0),
    'A5%': (reach(5) * 100).toFixed(0),
    'A8%': (reach(8) * 100).toFixed(0),
    'win%': ((results.filter((r) => r.won).length / n) * 100).toFixed(1),
    throws: avgThrows.toFixed(1),
    rerolls: rerolls.toFixed(1),
  };
}

function main() {
  const args = process.argv.slice(2);
  const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);
  const only = args
    .find((a) => a.startsWith('--bots='))
    ?.slice(7)
    .split(',');
  const profiles = args
    .find((a) => a.startsWith('--profiles='))
    ?.slice(11)
    .split(',') ?? ['rookie'];
  const stake = Number(args.find((a) => a.startsWith('--stake='))?.slice(8) ?? 0);
  const num = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  if (num('throws')) BASE_LIMITS.throws = Number(num('throws'));
  if (num('rerolls')) BASE_LIMITS.rerolls = Number(num('rerolls'));
  const tArg = args.find((a) => a.startsWith('--targets='));
  if (tArg)
    tArg
      .slice(10)
      .split(',')
      .forEach((v, i) => (ANTE_TARGETS[i] = Number(v)));
  const rows: Record<string, unknown> = {};
  for (const p of profiles) {
    for (const [key, bot] of Object.entries(BOTS)) {
      if (only && !only.includes(key)) continue;
      const results = Array.from({ length: n }, (_, i) => playRun(p, `S${i}`, bot, stake));
      rows[`${p}/${bot.name}`] = summarize(results);
    }
  }
  console.table(rows);
  if (args.includes('--charms')) charmReport(n, profiles[0]);
  const detail = args.find((a) => a.startsWith('--detail='))?.slice(9);
  if (detail) anteReport(n, profiles[0], BOTS[detail], stake);
  if (args.includes('--hands')) handReport(n, profiles[0]);
}

function handReport(n: number, profile: string) {
  const results = Array.from({ length: n }, (_, i) => playRun(profile, `H${i}`, BOTS.smart));
  const total: Record<string, number> = {};
  for (const r of results) for (const [h, c] of Object.entries(r.hands)) total[h] = (total[h] ?? 0) + (c ?? 0);
  const all = Object.values(total).reduce((s, c) => s + c, 0);
  console.table(Object.fromEntries(Object.entries(total).map(([h, c]) => [h, { pct: ((c / all) * 100).toFixed(1) }])));
}

function anteReport(n: number, profile: string, bot: Bot, stake: number) {
  const results = Array.from({ length: n }, (_, i) => playRun(profile, `S${i}`, bot, stake));
  const rows: Record<string, unknown> = {};
  for (let a = 1; a <= 8; a++) {
    for (let i = 0; i < 3; i++) {
      const ts = results.flatMap((r) => r.tables).filter((t) => t.ante === a && t.idx === i);
      if (!ts.length) continue;
      const won = ts.filter((t) => t.won);
      const med = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? 0;
      rows[`A${a}.${i}`] = {
        played: ts.length,
        'win%': ((won.length / ts.length) * 100).toFixed(0),
        throwsWon: (won.reduce((s, t) => s + t.throws, 0) / Math.max(1, won.length)).toFixed(1),
        medRatio: med(ts.map((t) => t.ratio)).toFixed(2),
      };
    }
  }
  console.table(rows);
}

function charmReport(n: number, profile: string) {
  const results = Array.from({ length: n }, (_, i) => playRun(profile, `C${i}`, BOTS.smart));
  const stats: Record<string, { n: number; prog: number }> = {};
  for (const r of results) {
    const prog = r.ante + r.tableIndex / 3 + (r.won ? 1 : 0);
    for (const c of r.charms) {
      stats[c] ??= { n: 0, prog: 0 };
      stats[c].n += 1;
      stats[c].prog += prog;
    }
  }
  const rows = Object.entries(stats)
    .map(([id, s]) => ({ id, held: s.n, avgProgress: +(s.prog / s.n).toFixed(2) }))
    .sort((a, b) => b.avgProgress - a.avgProgress);
  console.table(rows);
}

if (process.argv[1]?.includes('simulate')) main();

export { PROFILES };
