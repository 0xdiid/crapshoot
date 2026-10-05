import {
  BOSSES,
  CHARMS,
  CONSUMABLES,
  FACE_SETS,
  FINAL_BOSS,
  HANDS,
  MODS,
  PACKS,
  UPGRADES,
  charmSellValue,
  dieName,
  dieSellValue,
  handValues,
  type CharmInst,
  type Die,
  type HandId,
  type RunState,
} from '../engine';
import { h } from './dom';
import { faceStrip } from './die';
import { px } from './icons';

/** Colors numbers in rules text the way the scoreboard does. */
export function rich(text: string): HTMLElement {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = esc
    .replace(/(?<![\w$])(x\d+(\.\d+)?( Mult| Odds)?)/g, '<b class="t-x">$1</b>')
    .replace(/(?<![x\d.])([+-]?\d+(\.\d+)? Chips)/g, '<b class="t-chips">$1</b>')
    .replace(/(?<![x\d.])([+-]?\d+(\.\d+)? Mult)/g, '<b class="t-mult">$1</b>')
    .replace(/(\$\d+)/g, '<b class="t-money">$1</b>')
    .replace(/([+-]?\d+ (Rerolls?|Throws?))/g, '<b class="t-heat">$1</b>');
  return h('span.rich', { html });
}

const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };

export function levelName(l: HandId): string {
  return HANDS[l].name;
}

export function levelEffect(l: HandId): string {
  const o = HANDS[l];
  return `+${o.lvlChips} Chips and +${o.lvlMult} Mult`;
}

/** A hand's name, rules and current value. */
export function handTip(id: HandId, run: RunState | null): HTMLElement {
  const hd = HANDS[id];
  const lvl = run?.levels[id] ?? 1;
  const v = handValues(id, lvl);
  return h(
    'div.tip',
    h('div.tip-head', h('span.hand-swatch', { style: { '--c': hd.color } }), h('div', h('div.tip-name', hd.name), h('div.tip-rarity', `Level ${lvl}`))),
    h('div.tip-body', hd.desc),
    h('div.tip-status', rich(`${v.chips} Chips x ${v.mult} Mult, plus the pips of the dice that make it`)),
    hd.minDice > 5 ? h('div.tip-foot', `Needs ${hd.minDice} dice`) : null,
  );
}

// ---------- Tooltip content ----------

export function charmTip(id: string, run: RunState | null, inst?: CharmInst): HTMLElement {
  const d = CHARMS[id];
  return h(
    'div.tip',
    h(
      'div.tip-head',
      h('span.tip-icon', px(d.icon, 40, 20)),
      h('div', h('div.tip-name', d.name), h(`div.tip-rarity.r-${d.rarity}`, RARITY_LABEL[d.rarity])),
    ),
    h('div.tip-body', rich(d.desc)),
    inst && d.status && run ? h('div.tip-status', rich(d.status(inst, run))) : null,
    inst ? h('div.tip-foot', `Sells for $${charmSellValue(inst)}`) : null,
  );
}

const KIND_LABEL = { cocktail: 'Cocktail', token: 'Token', trick: 'Trick' };

export function consumableTip(id: string, run: RunState | null): HTMLElement {
  const d = CONSUMABLES[id];
  const head = h(
    'div.tip-head',
    h('span.tip-icon', px(d.icon, 40, 20)),
    h('div', h('div.tip-name', d.name), h(`div.tip-rarity.r-${d.kind}`, KIND_LABEL[d.kind])),
  );
  if (d.kind === 'cocktail') {
    const lvl = run?.levels[d.level] ?? 1;
    const now = handValues(d.level, lvl);
    const next = handValues(d.level, lvl + 1);
    return h(
      'div.tip',
      head,
      h('div.tip-body', `Level up `, h('b', levelName(d.level)), ` (Lv ${lvl} → ${lvl + 1})`),
      h('div.tip-status', rich(`${now.chips} x ${now.mult}  →  ${next.chips} x ${next.mult}`)),
    );
  }
  if (d.kind === 'trick') {
    return h(
      'div.tip',
      head,
      h('div.tip-body', rich(d.desc)),
      h('div.tip-foot', d.targeted ? 'Use it at a table, on a thrown die' : 'Use it at a table'),
    );
  }
  return h(
    'div.tip',
    head,
    h('div.tip-body', rich(d.desc)),
    d.effect.type === 'mod'
      ? h(
          'div.tip-mod',
          h('span', px(MODS[d.effect.mod].icon, 16, 16)),
          h('b', MODS[d.effect.mod].name),
          ' ',
          rich(MODS[d.effect.mod].desc),
        )
      : null,
    h('div.tip-foot', 'Use it on a die'),
  );
}

export function dieTip(d: Die, opts: { standard?: boolean; sell?: boolean } = {}): HTMLElement {
  const fs = FACE_SETS[d.faceSet];
  return h(
    'div.tip',
    h('div.tip-name', dieName(d)),
    faceStrip(d, 22, opts.standard),
    h('div.tip-body', opts.standard ? 'House Dice: rolls as plain 1-6' : fs.desc),
    d.mods.map((m) => h('div.tip-mod', h('span', px(MODS[m].icon, 16, 16)), h('b', MODS[m].name), ' ', rich(MODS[m].desc))),
    d.mods.includes('hot') && d.hotChips > 0 ? h('div.tip-status', rich(`Hot: now +${d.hotChips} Chips`)) : null,
    opts.sell ? h('div.tip-foot', `Sells for $${dieSellValue(d)}`) : null,
  );
}

export function bossTip(id: string, rules: string[]): HTMLElement {
  const def = id === FINAL_BOSS.id ? FINAL_BOSS : BOSSES[id];
  return h(
    'div.tip',
    h('div.tip-head', h('span.tip-icon', px(def.icon, 40, 20)), h('div.tip-name', def.name)),
    rules.map((r) => h('div.tip-body', rich(BOSSES[r].desc))),
  );
}

export function upgradeTip(id: string): HTMLElement {
  const u = UPGRADES[id];
  return h(
    'div.tip',
    h(
      'div.tip-head',
      h('span.tip-icon', px(u.icon, 40, 20)),
      h('div', h('div.tip-name', u.name), h('div.tip-rarity.r-upgrade', 'Upgrade')),
    ),
    h('div.tip-body', rich(u.desc)),
    h('div.tip-foot', 'Permanent for this run'),
  );
}

export function packTip(id: string): HTMLElement {
  const p = PACKS[id];
  return h(
    'div.tip',
    h('div.tip-head', h('span.tip-icon', px(p.icon, 40, 20)), h('div.tip-name', p.name)),
    h('div.tip-body', p.desc),
  );
}

// ---------- Cards ----------

export interface CardOpts {
  price?: number;
  size?: 'sm' | 'md' | 'lg';
  desc?: boolean;
  onclick?: (e: MouseEvent) => void;
  cls?: string;
  badge?: string;
}

function card(
  kind: string,
  icon: string,
  name: string,
  sub: string,
  desc: string | null,
  opts: CardOpts,
  color?: string,
) {
  return h(
    'div.card',
    {
      class: `card-${kind} card-${opts.size ?? 'md'} ${opts.cls ?? ''}`,
      style: color ? { '--accent': color } : undefined,
      onclick: opts.onclick,
      tabindex: opts.onclick ? 0 : undefined,
    },
    h(
      'div.card-inner',
      h('div.card-icon', px(icon, 64, 32)),
      h('div.card-name', name),
      desc && opts.desc ? h('div.card-desc', rich(desc)) : null,
      h('div.card-sub', sub),
    ),
    opts.price !== undefined ? h('div.price-tag', `$${opts.price}`) : null,
    opts.badge ? h('div.card-badge', opts.badge) : null,
  );
}

export function charmCard(id: string, opts: CardOpts = {}) {
  const d = CHARMS[id];
  return card('charm', d.icon, d.name, RARITY_LABEL[d.rarity], d.desc, {
    ...opts,
    cls: `${opts.cls ?? ''} r-${d.rarity}`,
  });
}

export function consumableCard(id: string, opts: CardOpts = {}) {
  const d = CONSUMABLES[id];
  const desc =
    d.kind === 'token' && d.effect.type === 'mod'
      ? `${d.desc}. ${MODS[d.effect.mod].name}: ${MODS[d.effect.mod].desc}`
      : d.desc;
  return card(d.kind, d.icon, d.name, KIND_LABEL[d.kind], desc, opts);
}

export function upgradeCard(id: string, opts: CardOpts = {}) {
  const u = UPGRADES[id];
  return card('upgrade', u.icon, u.name, 'Upgrade', u.desc, opts);
}

export function packCard(id: string, opts: CardOpts = {}) {
  const p = PACKS[id];
  return card('pack', p.icon, p.name, 'Pack', p.desc, opts, p.color);
}
