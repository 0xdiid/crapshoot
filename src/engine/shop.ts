import { CHARMS, CHARM_IDS } from './data/charms';
import { COCKTAIL_IDS, CONSUMABLES, TOKEN_IDS, TRICK_IDS, type TokenDef } from './data/consumables';
import { FACE_SETS, MAX_MODS, MODS, MOD_IDS } from './data/dice';
import { HANDS } from './data/hands';
import { PACKS, PACK_IDS, UPGRADES, UPGRADE_IDS } from './data/meta';
import { pick, randInt, weightedPick } from './rng';
import { applyTrick, cantUseTrick } from './scoring';
import {
  addToBox,
  assert,
  charmSellValue,
  cloneDie,
  ensureMinDice,
  getDie,
  hasCharm,
  levelUp,
  limits,
  makeCharm,
  makeDie,
  newUid,
  price,
} from './state';
import type { Die, FaceSetId, HandId, ModId, PackOption, RunState, ShopItem } from './types';
import { WILD } from './types';

const RARITY_WEIGHT = { common: 70, uncommon: 26, rare: 6 };

function randomCharmId(run: RunState, exclude: string[]): string | null {
  const pool = CHARM_IDS.filter((id) => !exclude.includes(id) && !hasCharm(run, id));
  if (pool.length === 0) return null;
  return weightedPick(run, pool, (id) => RARITY_WEIGHT[CHARMS[id].rarity]);
}

function randomMod(run: RunState): ModId {
  return weightedPick(run, MOD_IDS, (m) => RARITY_WEIGHT[MODS[m].rarity]);
}

export function randomDie(run: RunState): Die {
  const r = randInt(run, 100);
  const special = (Object.keys(FACE_SETS) as FaceSetId[]).filter((f) => f !== 'standard');
  const pickFace = () => weightedPick(run, special, (f) => RARITY_WEIGHT[FACE_SETS[f].rarity]);
  if (r < 45) return makeDie(run, 'standard', [randomMod(run)]);
  if (r < 85) return makeDie(run, pickFace());
  return makeDie(run, pickFace(), [randomMod(run)]);
}

export function diePrice(d: Die): number {
  const fs = FACE_SETS[d.faceSet].rarity;
  return 3 + d.mods.length * 2 + (fs === 'uncommon' ? 1 : fs === 'rare' ? 2 : 0);
}

function shopSlot(run: RunState, taken: string[]): ShopItem {
  const r = randInt(run, 100);
  if (r < 65) {
    const id = randomCharmId(run, taken);
    if (id) {
      taken.push(id);
      return {
        kind: 'charm',
        id,
        price: price(run, CHARMS[id].price),
        sold: false,
      };
    }
  }
  const id = r < 85 ? pick(run, cocktailPool(run)) : r < 93 ? pick(run, TOKEN_IDS) : pick(run, TRICK_IDS);
  return {
    kind: 'consumable',
    id,
    price: price(run, CONSUMABLES[id].price),
    sold: false,
  };
}

/** Cocktails for the secret six-dice hands only show up once you can throw six dice. */
function cocktailPool(run: RunState): string[] {
  const size = limits(run).cupSize + run.box.filter((d) => d.mods.includes('twin')).length;
  return COCKTAIL_IDS.filter((id) => HANDS[(CONSUMABLES[id] as { level: HandId }).level].minDice <= Math.max(5, size));
}

function rollItems(run: RunState): { items: ShopItem[]; dice: ShopItem[] } {
  const taken: string[] = [];
  const items = [0, 1, 2].map(() => shopSlot(run, taken));
  const die = randomDie(run);
  return {
    items,
    dice: [{ kind: 'die', die, price: price(run, diePrice(die)), sold: false }],
  };
}

export function generateShop(run: RunState): void {
  const { items, dice } = rollItems(run);
  const packs: ShopItem[] = [0, 1].map(() => {
    const id = pick(run, PACK_IDS);
    return {
      kind: 'pack',
      id,
      price: price(run, PACKS[id].price),
      sold: false,
    };
  });
  let upgrade: ShopItem | null = null;
  if (run.shopUpgradeBoughtAnte !== run.ante) {
    if (!run.upgradeOffer || run.upgradeOffer.ante !== run.ante) {
      const pool = UPGRADE_IDS.filter((u) => !run.upgrades.includes(u));
      run.upgradeOffer = pool.length ? { ante: run.ante, id: pick(run, pool) } : null;
    }
    if (run.upgradeOffer) {
      const id = run.upgradeOffer.id;
      upgrade = {
        kind: 'upgrade',
        id,
        price: price(run, UPGRADES[id].price),
        sold: false,
      };
    }
  }
  run.shop = {
    items,
    dice,
    packs,
    upgrade,
    restockCost: limits(run).restockBase,
    openPack: null,
  };
}

export function restockShop(run: RunState): void {
  const shop = run.shop;
  assert(run.phase === 'shop' && shop, 'Not in shop');
  assert(!shop.openPack, 'Finish your pack first');
  assert(run.money >= shop.restockCost, 'Not enough money');
  run.money -= shop.restockCost;
  shop.restockCost += 1;
  const { items, dice } = rollItems(run);
  shop.items = items;
  shop.dice = dice;
}

export type ShopRef = {
  group: 'items' | 'dice' | 'packs' | 'upgrade';
  index: number;
};

export function shopItem(run: RunState, ref: ShopRef): ShopItem | null {
  const s = run.shop;
  if (!s) return null;
  if (ref.group === 'upgrade') return s.upgrade;
  return s[ref.group][ref.index] ?? null;
}

/** Why an item can't be bought right now, or null if it can. */
export function cantBuy(run: RunState, item: ShopItem): string | null {
  if (item.sold) return 'Sold out';
  if (run.money < item.price) return 'Not enough money';
  const lim = limits(run);
  if (item.kind === 'charm' && run.charms.length >= lim.charmSlots) return 'Charm slots full';
  if (item.kind === 'consumable' && run.consumables.length >= lim.consumableSlots) return 'Comp slots full';
  if (item.kind === 'die' && run.box.length >= lim.boxSize) return 'Dice Box full';
  if (item.kind === 'pack' && run.shop?.openPack) return 'Already opening a pack';
  return null;
}

export function buy(run: RunState, ref: ShopRef): ShopItem {
  assert(run.phase === 'shop' && run.shop, 'Not in shop');
  assert(!run.shop.openPack, 'Finish your pack first');
  const item = shopItem(run, ref);
  assert(item, 'No such item');
  const why = cantBuy(run, item);
  assert(!why, why ?? '');
  run.money -= item.price;
  item.sold = true;
  switch (item.kind) {
    case 'charm':
      run.charms.push(makeCharm(run, item.id));
      break;
    case 'consumable':
      run.consumables.push({ uid: newUid(run, 'k'), id: item.id });
      break;
    case 'die':
      addToBox(run, item.die);
      ensureMinDice(run);
      break;
    case 'upgrade':
      run.upgrades.push(item.id);
      run.shopUpgradeBoughtAnte = run.ante;
      if (item.id === 'restock_deal') run.shop.restockCost = Math.max(1, run.shop.restockCost - 2);
      ensureMinDice(run);
      break;
    case 'pack':
      run.shop.openPack = {
        packId: item.id,
        options: packOptions(run, item.id),
        picksLeft: 1,
      };
      break;
  }
  return item;
}

function packOptions(run: RunState, packId: string): PackOption[] {
  const def = PACKS[packId];
  const out: PackOption[] = [];
  const taken: string[] = [];
  for (let i = 0; i < def.size; i++) {
    if (def.contents === 'charm') {
      const id = randomCharmId(run, taken);
      if (!id) break;
      taken.push(id);
      out.push({ kind: 'charm', id });
    } else if (def.contents === 'die') {
      out.push({ kind: 'die', die: randomDie(run) });
    } else {
      const all = def.contents === 'cocktail' ? cocktailPool(run) : def.contents === 'trick' ? TRICK_IDS : TOKEN_IDS;
      const pool = all.filter((id) => !taken.includes(id));
      const id = pick(run, pool);
      taken.push(id);
      out.push({ kind: 'consumable', id });
    }
  }
  return out;
}

export function cantPick(run: RunState, index: number, dieUid?: string): string | null {
  const pack = run.shop?.openPack;
  if (!pack) return 'No pack open';
  const opt = pack.options[index];
  if (!opt) return 'No such option';
  const lim = limits(run);
  if (opt.kind === 'charm' && run.charms.length >= lim.charmSlots) return 'Charm slots full';
  if (opt.kind === 'die' && run.box.length >= lim.boxSize) return 'Dice Box full';
  if (opt.kind === 'consumable') {
    const def = CONSUMABLES[opt.id];
    if (def.kind === 'token') {
      if (!dieUid) return 'Pick a die';
      return cantApplyToken(run, def, dieUid);
    }
    if (def.kind === 'trick' && run.consumables.length >= lim.consumableSlots) return 'Comp slots full';
  }
  return null;
}

export function pickPackOption(run: RunState, index: number, dieUid?: string): PackOption {
  const pack = run.shop?.openPack;
  assert(pack, 'No pack open');
  const why = cantPick(run, index, dieUid);
  assert(!why, why ?? '');
  const opt = pack.options[index];
  if (opt.kind === 'charm') run.charms.push(makeCharm(run, opt.id));
  else if (opt.kind === 'die') {
    addToBox(run, opt.die);
    ensureMinDice(run);
  } else {
    const def = CONSUMABLES[opt.id];
    if (def.kind === 'cocktail') drink(run, def.level);
    else if (def.kind === 'token') applyToken(run, def, dieUid!);
    else run.consumables.push({ uid: newUid(run, 'k'), id: opt.id });
  }
  pack.picksLeft -= 1;
  pack.options.splice(index, 1);
  if (pack.picksLeft <= 0 || pack.options.length === 0) run.shop!.openPack = null;
  return opt;
}

export function skipPack(run: RunState): void {
  assert(run.shop?.openPack, 'No pack open');
  run.shop.openPack = null;
}

// ---------- Levels & consumables ----------

/** Drinks a cocktail: levels up its hand and tells the charms. */
export function drink(run: RunState, hand: HandId): number {
  const times = levelUp(run, hand);
  for (const c of run.charms) CHARMS[c.id]?.onCocktail?.(run, c);
  return times;
}

export function cantApplyToken(run: RunState, def: TokenDef, dieUid: string): string | null {
  const die = getDie(run, dieUid);
  if (!die) return 'Pick a die';
  const e = def.effect;
  if (e.type === 'mod' && die.mods.length >= MAX_MODS) return `Dice hold at most ${MAX_MODS} mods`;
  if (e.type === 'photocopy' && run.box.length >= limits(run).boxSize) return 'Dice Box full';
  if (e.type === 'solvent' && die.mods.length === 0) return 'That die has no mods';
  if (e.type === 'wildcard' && !die.faces.some((f) => f !== WILD)) return 'Already all wild';
  return null;
}

export function applyToken(run: RunState, def: TokenDef, dieUid: string): void {
  const why = cantApplyToken(run, def, dieUid);
  assert(!why, why ?? '');
  const die = getDie(run, dieUid)!;
  const e = def.effect;
  const lowestIdx = () => {
    let best = -1;
    die.faces.forEach((f, i) => {
      if (f !== WILD && (best < 0 || f < die.faces[best])) best = i;
    });
    return best;
  };
  switch (e.type) {
    case 'mod':
      die.mods.push(e.mod);
      break;
    case 'chisel': {
      const i = lowestIdx();
      if (i >= 0) die.faces[i] = 6;
      break;
    }
    case 'sandpaper': {
      let best = -1;
      die.faces.forEach((f, i) => {
        if (f !== WILD && (best < 0 || f > die.faces[best])) best = i;
      });
      if (best >= 0) die.faces[best] = 1;
      break;
    }
    case 'wildcard': {
      const i = lowestIdx();
      if (i >= 0) die.faces[i] = WILD;
      break;
    }
    case 'photocopy':
      cloneDie(run, die);
      break;
    case 'solvent':
      run.money += die.mods.length * 4;
      die.mods = [];
      break;
  }
}

/** `target` is a Box die uid for tokens, or a thrown die id for tricks. */
export function cantUseConsumable(run: RunState, uid: string, target?: string): string | null {
  const inst = run.consumables.find((c) => c.uid === uid);
  if (!inst) return 'No such comp';
  if (!['shop', 'select', 'table'].includes(run.phase)) return 'Not now';
  if (run.phase === 'table' && run.table?.finished) return 'Not now';
  const def = CONSUMABLES[inst.id];
  if (def.kind === 'trick') return cantUseTrick(run, def, target);
  if (def.kind === 'token') {
    if (!target) return 'Pick a die';
    if (run.phase === 'table' && !run.cup.includes(target)) return 'Pick a die in your Cup';
    if (run.phase === 'table' && run.table?.dice) return 'Use tokens between throws';
    return cantApplyToken(run, def, target);
  }
  return null;
}

export function useConsumable(run: RunState, uid: string, target?: string): void {
  const why = cantUseConsumable(run, uid, target);
  assert(!why, why ?? '');
  const idx = run.consumables.findIndex((c) => c.uid === uid);
  const def = CONSUMABLES[run.consumables[idx].id];
  run.consumables.splice(idx, 1);
  if (def.kind === 'cocktail') drink(run, def.level);
  else if (def.kind === 'token') applyToken(run, def, target!);
  else applyTrick(run, def, target);
}

export function sellConsumable(run: RunState, uid: string): number {
  const idx = run.consumables.findIndex((c) => c.uid === uid);
  assert(idx >= 0, 'No such comp');
  run.consumables.splice(idx, 1);
  run.money += 1;
  return 1;
}

// ---------- Charms ----------

export function sellCharm(run: RunState, uid: string): number {
  const idx = run.charms.findIndex((c) => c.uid === uid);
  assert(idx >= 0, 'No such charm');
  assert(run.phase !== 'table' || !run.table?.finished, 'Not now');
  const value = charmSellValue(run.charms[idx]);
  run.charms.splice(idx, 1);
  run.money += value;
  return value;
}

export function moveCharm(run: RunState, from: number, to: number): void {
  const [c] = run.charms.splice(from, 1);
  if (!c) return;
  run.charms.splice(Math.max(0, Math.min(to, run.charms.length)), 0, c);
}

// ---------- Dice box ----------

export const FUSE_COST = 3;

export function dieSellValue(d: Die): number {
  return 1 + d.mods.length;
}

export function cantSellDie(run: RunState, uid: string): string | null {
  if (run.phase === 'table') return 'Not during a table';
  if (!getDie(run, uid)) return 'No such die';
  if (run.box.length <= 1) return 'You need at least 1 die';
  return null;
}

export function sellDie(run: RunState, uid: string): number {
  const why = cantSellDie(run, uid);
  assert(!why, why ?? '');
  const d = getDie(run, uid)!;
  run.box = run.box.filter((x) => x.uid !== uid);
  run.cup = run.cup.filter((x) => x !== uid);
  const v = dieSellValue(d);
  run.money += v;
  ensureMinDice(run);
  return v;
}

export function cantFuse(run: RunState, keepUid: string, feedUid: string): string | null {
  if (run.phase === 'table') return 'Not during a table';
  if (keepUid === feedUid) return 'Pick two different dice';
  const a = getDie(run, keepUid);
  const b = getDie(run, feedUid);
  if (!a || !b) return 'No such die';
  if (a.mods.length + b.mods.length > MAX_MODS) return `A fused die holds at most ${MAX_MODS} mods`;
  if (run.money < FUSE_COST) return 'Not enough money';
  return null;
}

export function fusePreview(run: RunState, keepUid: string, feedUid: string, facesFrom: 'keep' | 'feed'): Die | null {
  const a = getDie(run, keepUid);
  const b = getDie(run, feedUid);
  if (!a || !b) return null;
  const src = facesFrom === 'keep' ? a : b;
  return {
    uid: a.uid,
    faceSet: src.faceSet,
    faces: [...src.faces],
    mods: [...a.mods, ...b.mods].slice(0, MAX_MODS),
    hotChips: a.hotChips + b.hotChips,
  };
}

export function fuseDice(run: RunState, keepUid: string, feedUid: string, facesFrom: 'keep' | 'feed'): Die {
  const why = cantFuse(run, keepUid, feedUid);
  assert(!why, why ?? '');
  const fused = fusePreview(run, keepUid, feedUid, facesFrom)!;
  run.money -= FUSE_COST;
  const idx = run.box.findIndex((d) => d.uid === keepUid);
  run.box[idx] = fused;
  run.box = run.box.filter((d) => d.uid !== feedUid);
  run.cup = run.cup.filter((u) => u !== feedUid);
  ensureMinDice(run);
  return fused;
}

export function setInCup(run: RunState, uid: string, inCup: boolean): void {
  assert(run.phase !== 'table', 'Not during a table');
  assert(getDie(run, uid), 'No such die');
  if (inCup) {
    if (run.cup.includes(uid)) return;
    assert(run.cup.length < limits(run).cupSize, 'Cup is full');
    run.cup.push(uid);
  } else {
    assert(run.cup.length > 1, 'Keep at least 1 die in the Cup');
    run.cup = run.cup.filter((u) => u !== uid);
  }
}

/** Moves a Cup die to a new position (dice are thrown left to right). */
export function moveInCup(run: RunState, uid: string, index: number): void {
  assert(run.phase !== 'table', 'Not during a table');
  const from = run.cup.indexOf(uid);
  assert(from >= 0, 'Not in the Cup');
  run.cup.splice(from, 1);
  run.cup.splice(Math.max(0, Math.min(index, run.cup.length)), 0, uid);
}

export function swapCup(run: RunState, outUid: string, inUid: string): void {
  assert(run.phase !== 'table', 'Not during a table');
  const i = run.cup.indexOf(outUid);
  assert(i >= 0 && !run.cup.includes(inUid) && getDie(run, inUid), 'Bad swap');
  run.cup[i] = inUid;
}
