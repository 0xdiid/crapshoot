import { makeCharm, newRun, startTable, throwCup, type Die, type RunState } from '../src/engine';

/** A die that always shows `v`. */
export function fixedDie(run: RunState, v: number, mods: Die['mods'] = []): Die {
  run.nextUid += 1;
  return { uid: `t${run.nextUid}`, faceSet: 'standard', faces: [v, v, v, v, v, v], mods, hotChips: 0 };
}

/** A run at a table whose Cup holds fixed dice showing the given values. */
export function tableWith(values: number[], opts: { charms?: string[]; seed?: string; target?: number; mods?: Die['mods'][] } = {}) {
  const run = newRun({ profileId: 'rookie', seed: opts.seed ?? 'TEST' });
  run.box = values.map((v, i) => fixedDie(run, v, opts.mods?.[i] ?? []));
  run.cup = run.box.map((d) => d.uid);
  run.charms = (opts.charms ?? []).map((id) => makeCharm(run, id));
  run.upgrades.push('big_cup', 'big_cup', 'big_cup');
  const t = startTable(run);
  t.target = opts.target ?? 1e9;
  return { run, t, dice: run.box };
}

/** Starts a table and throws, returning the dice on the felt. */
export function thrown(values: number[], opts: Parameters<typeof tableWith>[1] = {}) {
  const r = tableWith(values, opts);
  throwCup(r.run);
  return r;
}
