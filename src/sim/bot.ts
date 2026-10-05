import {
  buy,
  cantBuy,
  cantFuse,
  cantPick,
  cantReroll,
  cantUseConsumable,
  CHARMS,
  CONSUMABLES,
  findHands,
  fuseDice,
  getDie,
  handValues,
  limits,
  nextFloat,
  passives,
  pickPackOption,
  restockShop,
  reroll,
  sellCharm,
  skipPack,
  toggleHold,
  useConsumable,
  WILD,
  type Die,
  type HandId,
  type RunState,
  type ShopItem,
  type ShopRef,
  type TableDie,
} from '../engine';

export type HoldPolicy = 'random' | 'basic' | 'smart';
export type ShopPolicy = 'none' | 'random' | 'smart';

export interface Bot {
  name: string;
  hold: HoldPolicy;
  shop: ShopPolicy;
}

// ---------- Table play ----------

/** Fast score estimate for a set of faces: best hand by base value and pips, ignoring charms. */
function estimate(run: RunState, faces: number[]): number {
  const fixed = faces.filter((f) => f !== WILD);
  const common = fixed.length ? mode(fixed) : 6;
  const vals = faces.map((f) => (f === WILD ? common : f));
  const p = passives(run);
  const hands = findHands(vals, { shortcut: p.shortcut, fourFingers: p.fourFingers });
  let best = 0;
  for (const [h, idx] of Object.entries(hands) as [HandId, number[]][]) {
    const v = handValues(h, run.levels[h]);
    const pips = (p.allScore ? vals : idx.map((i) => vals[i])).reduce((s, f) => s + f, 0);
    best = Math.max(best, (v.chips + pips) * v.mult);
  }
  return best;
}

function mode(xs: number[]): number {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const x of xs) c[x] += 1;
  let best = xs[0];
  for (let f = 6; f >= 1; f--) if (c[f] > c[best]) best = f;
  return best;
}

function facesOf(run: RunState, d: TableDie): number[] {
  const t = run.table!;
  return t.bossRules.includes('house_dice') ? [1, 2, 3, 4, 5, 6] : (getDie(run, d.uid)?.faces ?? [1, 2, 3, 4, 5, 6]);
}

/** Candidate sets of dice to keep. */
function candidates(dice: TableDie[]): Set<string>[] {
  const out: Set<string>[] = [new Set()];
  const byFace = new Map<number, string[]>();
  for (const d of dice) byFace.set(d.face, [...(byFace.get(d.face) ?? []), d.id]);
  for (const ids of byFace.values()) out.push(new Set(ids));
  const groups = [...byFace.entries()]
    .filter(([f, v]) => f !== WILD && v.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  const wilds = byFace.get(WILD) ?? [];
  if (groups.length >= 2) out.push(new Set([...groups[0][1], ...groups[1][1], ...wilds]));
  for (const [, ids] of byFace) out.push(new Set([...ids, ...wilds]));
  for (const [lo, hi] of [
    [1, 5],
    [2, 6],
    [1, 4],
    [2, 5],
    [3, 6],
  ]) {
    const keep = new Set<string>(wilds);
    for (let f = lo; f <= hi; f++) {
      const id = byFace.get(f)?.[0];
      if (id) keep.add(id);
    }
    out.push(keep);
  }
  return out;
}

function expected(run: RunState, dice: TableDie[], keep: Set<string>, samples: number): number {
  let total = 0;
  for (let s = 0; s < samples; s++) {
    const faces = dice.map((d) => {
      if (keep.has(d.id)) return d.face;
      const fs = facesOf(run, d);
      return fs[Math.floor(nextFloat(run) * fs.length)];
    });
    total += estimate(run, faces);
  }
  return total / samples;
}

/** Holds and rerolls until the bot is happy. Leaves the dice ready to score. */
export function playThrow(run: RunState, bot: Bot): void {
  const t = run.table!;
  const budgetAtStart = t.rerollsLeft;
  for (let guard = 0; guard < 20 && !cantReroll(run); guard++) {
    const dice = t.dice!;
    if (bot.hold === 'random') {
      if (nextFloat(run) < 0.4) return;
      for (const d of dice) toggleHold(run, d.id, nextFloat(run) < 0.5);
      if (cantReroll(run)) return;
      reroll(run);
      continue;
    }
    const now = estimate(
      run,
      dice.map((d) => d.face),
    );
    if (t.score + now >= t.target) return;
    let keep: Set<string>;
    let ev: number;
    if (bot.hold === 'basic') {
      const f = mode(dice.map((d) => d.face));
      keep = new Set(dice.filter((d) => d.face === f).map((d) => d.id));
      ev = Infinity;
    } else {
      keep = new Set();
      ev = -1;
      for (const c of candidates(dice)) {
        if (c.size === dice.length) continue;
        const v = expected(run, dice, c, 16);
        if (v > ev) {
          ev = v;
          keep = c;
        }
      }
      // Spread the reroll pool over the remaining throws.
      const share = Math.ceil(budgetAtStart / Math.max(1, t.throwsLeft));
      const lastThrow = t.throwsLeft <= 1;
      if (!lastThrow && t.rerollsThisThrow >= share && ev < now * 1.6) return;
      if (ev < now * 1.08) return;
    }
    for (const d of dice) toggleHold(run, d.id, keep.has(d.id));
    if (cantReroll(run)) return;
    reroll(run);
  }
}

// ---------- Shopping ----------

function charmScore(id: string): number {
  const d = CHARMS[id];
  return d.price + (d.rarity === 'rare' ? 3 : d.rarity === 'uncommon' ? 1 : 0);
}

function dieScore(d: Die): number {
  let s = d.mods.length * 3;
  if (d.faceSet === 'wild') s += 4;
  if (d.faceSet === 'loaded' || d.faceSet === 'highball') s += 1;
  if (d.mods.includes('mirror') || d.mods.includes('twin')) s += 2;
  return s;
}

function tryBuy(run: RunState, ref: ShopRef, item: ShopItem): boolean {
  if (cantBuy(run, item)) return false;
  buy(run, ref);
  return true;
}

function tokenTarget(run: RunState): string {
  return [...run.cup].sort((a, b) => getDie(run, a)!.mods.length - getDie(run, b)!.mods.length)[0];
}

function handlePack(run: RunState) {
  const pack = run.shop?.openPack;
  if (!pack) return;
  let bestIdx = -1;
  let bestScore = -Infinity;
  const target = tokenTarget(run);
  const dieFor = (i: number) => {
    const o = pack.options[i];
    return o.kind === 'consumable' && CONSUMABLES[o.id].kind === 'token' ? target : undefined;
  };
  pack.options.forEach((o, i) => {
    if (cantPick(run, i, dieFor(i))) return;
    const s = o.kind === 'charm' ? charmScore(o.id) : o.kind === 'die' ? dieScore(o.die) : 1 + nextFloat(run);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });
  if (bestIdx < 0) return skipPack(run);
  pickPackOption(run, bestIdx, dieFor(bestIdx));
}

/** Uses cocktails, tokens and untargeted tricks when allowed. */
export function useComps(run: RunState) {
  for (const c of [...run.consumables]) {
    const def = CONSUMABLES[c.id];
    if (def.kind === 'trick' && def.targeted) continue;
    const target = def.kind === 'token' ? tokenTarget(run) : undefined;
    if (!cantUseConsumable(run, c.uid, target)) useConsumable(run, c.uid, target);
  }
}

export function shop(run: RunState, bot: Bot) {
  if (bot.shop === 'none' || !run.shop) return;
  const s = run.shop;
  const lim = limits(run);
  if (bot.shop === 'random') {
    const all: [ShopRef, ShopItem][] = [
      ...s.items.map((it, i) => [{ group: 'items', index: i }, it] as [ShopRef, ShopItem]),
      ...s.packs.map((it, i) => [{ group: 'packs', index: i }, it] as [ShopRef, ShopItem]),
    ];
    for (const [ref, it] of all) {
      if (nextFloat(run) < 0.5 && tryBuy(run, ref, it)) handlePack(run);
    }
    useComps(run);
    return;
  }

  const reserve = run.ante >= 2 ? Math.min(lim.interestCap * 5, 5 * run.ante) : 0;
  const spendable = () => run.money - reserve;

  for (let pass = 0; pass < 3; pass++) {
    const upgradeOk = run.charms.length >= lim.charmSlots - 1 || run.money >= 25;
    if (upgradeOk && s.upgrade && !s.upgrade.sold && spendable() >= s.upgrade.price)
      tryBuy(run, { group: 'upgrade', index: 0 }, s.upgrade);
    s.items.forEach((it, i) => {
      if (it.sold || spendable() < it.price) return;
      if (it.kind === 'charm') {
        if (run.charms.length >= lim.charmSlots) {
          const worst = [...run.charms].sort((a, b) => charmScore(a.id) - charmScore(b.id))[0];
          if (charmScore(it.id) > charmScore(worst.id) + 2) sellCharm(run, worst.uid);
        }
        tryBuy(run, { group: 'items', index: i }, it);
      } else if (it.kind === 'consumable') {
        tryBuy(run, { group: 'items', index: i }, it);
      }
    });
    s.dice.forEach((it, i) => {
      if (it.kind !== 'die' || it.sold || spendable() < it.price) return;
      if (dieScore(it.die) >= 3 && run.box.length < lim.boxSize) tryBuy(run, { group: 'dice', index: i }, it);
    });
    s.packs.forEach((it, i) => {
      if (it.sold || spendable() < it.price || it.kind !== 'pack') return;
      if (it.id === 'charm_box' && run.charms.length >= lim.charmSlots) return;
      if (tryBuy(run, { group: 'packs', index: i }, it)) handlePack(run);
    });
    useComps(run);
    if (run.charms.length < lim.charmSlots && spendable() >= s.restockCost + 6) restockShop(run);
    else break;
  }

  const modded = [...run.box].filter((d) => d.mods.length > 0).sort((a, b) => dieScore(b) - dieScore(a));
  if (modded.length >= 2 && !cantFuse(run, modded[0].uid, modded[1].uid) && spendable() >= 3) {
    const faceFrom = dieScore({ ...modded[1], mods: [] }) > dieScore({ ...modded[0], mods: [] }) ? 'feed' : 'keep';
    fuseDice(run, modded[0].uid, modded[1].uid, faceFrom);
  }
  if (run.charms.some((c) => c.id === 'light_pockets')) return;
  const best = [...run.box].sort((a, b) => dieScore(b) - dieScore(a)).slice(0, lim.cupSize);
  run.cup = best.map((d) => d.uid);
}
