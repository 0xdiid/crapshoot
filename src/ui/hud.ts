import {
  CHARMS,
  CONSUMABLES,
  cupDice,
  cantUseConsumable,
  charmSellValue,
  limits,
  moveCharm,
  sellCharm,
  sellConsumable,
  useConsumable,
  type CharmInst,
  type RunState,
} from '../engine';
import type { App } from './app';
import { sfx } from './audio';
import { charmTip, consumableTip, levelName } from './cards';
import { pickDie } from './dicebox';
import { center, h } from './dom';
import { burst, floatText } from './fx';
import { tip } from './tooltip';
import { topBar, win, type Stat } from './chrome';
import { openPause } from './menus';
import { px } from './icons';

export function moneyPill(app: App): HTMLElement {
  return h('div.money-pill', px('💰', 28, 14), h('span', `$${app.run?.money ?? 0}`));
}

/** The in-game header used by every run screen. */
export function gameBar(app: App, stats: Stat[]): HTMLElement {
  return topBar(stats, [
    moneyPill(app),
    h('button.btn.menu-btn', { onclick: () => (sfx.click(), openPause(app)), title: 'Menu (Esc)' }, 'Menu'),
  ]);
}

export function charmRail(app: App, onChange: () => void, opts: { sell?: boolean } = {}): HTMLElement {
  const run = app.run!;
  const lim = limits(run);
  const slots = Array.from({ length: lim.charmSlots }, (_, i) => {
    const c = run.charms[i];
    if (!c) return h('div.charm-slot.empty');
    const def = CHARMS[c.id];
    const el = h(
      'button.charm',
      { class: `r-${def.rarity}`, 'data-uid': c.uid, onclick: () => openCharm(app, c, onChange, opts) },
      h('span.charm-icon', px(def.icon, 48, 24)),
      def.status && counterText(c, run) ? h('span.charm-counter', counterText(c, run)) : null,
    );
    tip(el, () => charmTip(c.id, run, c));
    return h('div.charm-slot', el);
  });
  return win(`Charms ${run.charms.length}/${lim.charmSlots}`, [h('div.charm-row', slots)], {
    palette: true,
    cls: 'charm-rail',
  });
}

/** Short live value for scaling charms, from their status line ("Now x1.4 Mult" -> "x1.4"). */
function counterText(c: CharmInst, run: RunState): string {
  const st = CHARMS[c.id].status?.(c, run) ?? '';
  const m = st.match(/[x+][\d.]+/);
  return m ? m[0] : '';
}

function openCharm(app: App, c: CharmInst, onChange: () => void, opts: { sell?: boolean }) {
  const run = app.run!;
  const idx = run.charms.indexOf(c);
  sfx.click();
  let close = () => {};
  close = app.modal(
    h(
      'div.item-pop',
      charmTip(c.id, run, c),
      h(
        'div.row',
        h(
          'button.btn',
          { disabled: idx <= 0, onclick: () => (moveCharm(run, idx, idx - 1), app.save(), close(), onChange()) },
          '◀ Move',
        ),
        h(
          'button.btn',
          {
            disabled: idx >= run.charms.length - 1,
            onclick: () => (moveCharm(run, idx, idx + 1), app.save(), close(), onChange()),
          },
          'Move ▶',
        ),
      ),
      opts.sell !== false
        ? h(
            'button.btn.btn-danger.btn-wide',
            {
              onclick: () => {
                const v = app.act(() => sellCharm(run, c.uid));
                if (v === undefined) return;
                sfx.sell();
                app.toast(`Sold ${CHARMS[c.id].name} for $${v}`);
                close();
                onChange();
              },
            },
            `Sell for $${charmSellValue(c)}`,
          )
        : null,
      h('p.muted.small', 'Charms trigger left to right. Order matters for x Mult.'),
    ),
  );
}

export function compRail(app: App, onChange: () => void): HTMLElement {
  const run = app.run!;
  const lim = limits(run);
  const slots = Array.from({ length: lim.consumableSlots }, (_, i) => {
    const c = run.consumables[i];
    if (!c) return h('div.comp-slot.empty');
    const def = CONSUMABLES[c.id];
    const el = h(
      'button.comp',
      { class: `comp-${def.kind}`, onclick: () => openComp(app, c.uid, onChange) },
      h('span', px(def.icon, 48, 24)),
    );
    tip(el, () => consumableTip(c.id, run));
    return h('div.comp-slot', el);
  });
  return win(`Comps ${run.consumables.length}/${lim.consumableSlots}`, [h('div.comp-row', slots)], {
    palette: true,
    cls: 'comp-rail',
  });
}

export async function useComp(app: App, uid: string, onChange: () => void, anchor?: Element | null) {
  const run = app.run!;
  const inst = run.consumables.find((c) => c.uid === uid);
  if (!inst) return;
  const def = CONSUMABLES[inst.id];
  let dieUid: string | undefined;
  if (def.kind === 'token') {
    const pool = run.phase === 'table' ? cupDice(run) : run.box;
    const picked = await pickDie(app, `${def.name}: pick a die`, pool, (u) =>
      cantUseConsumable(run, uid, u),
    );
    if (!picked) return;
    dieUid = picked;
  }
  if (def.kind === 'trick') {
    const why = cantUseConsumable(run, uid, def.targeted ? run.table?.dice?.[0]?.id : undefined);
    if (why && !def.targeted) return void app.toast(why, 'bad');
    if (def.targeted) {
      if (!run.table?.dice) return void app.toast('Throw first, then use it on a die', 'bad');
      const picked = await app.pickThrown?.(`${def.name}: pick a die on the felt`, (id) => cantUseConsumable(run, uid, id));
      if (!picked) return;
      dieUid = picked;
    }
  }
  const before = def.kind === 'cocktail' ? run.levels[def.level] : 0;
  if (!app.ok(() => useConsumable(run, uid, dieUid))) return;
  const pos = anchor ? center(anchor) : { x: innerWidth / 2, y: innerHeight / 2 };
  if (def.kind === 'cocktail') {
    sfx.levelUp();
    const after = run.levels[def.level];
    floatText(pos.x, pos.y - 20, `${levelName(def.level)} Lv ${after}`, 'note', true);
    if (after - before > 1) app.toast('Mixologist: double pour!', 'good');
    burst(pos.x, pos.y, 'star', 18, ['#f20884', '#fcf305', '#fff'], 6);
  } else {
    sfx.fuse();
    burst(pos.x, pos.y, 'star', 14, ['#02abea', '#fff'], 5);
    if (def.kind === 'token') app.toast(`${def.name} applied`, 'good');
  }
  onChange();
  if (def.kind === 'trick') app.afterTrick?.(def.id, dieUid);
}

function openComp(app: App, uid: string, onChange: () => void) {
  const run = app.run!;
  const inst = run.consumables.find((c) => c.uid === uid)!;
  sfx.click();
  const def = CONSUMABLES[inst.id];
  const why =
    def.kind === 'cocktail' || (def.kind === 'trick' && !def.targeted)
      ? cantUseConsumable(run, uid)
      : def.kind === 'trick' && !run.table?.dice
        ? run.phase === 'table'
          ? 'Throw first, then use it on a die'
          : 'Use it at a table, on a thrown die'
        : null;
  let close = () => {};
  close = app.modal(
    h(
      'div.item-pop',
      consumableTip(inst.id, run),
      h(
        'div.row',
        h(
          'button.btn.btn-primary',
          {
            disabled: !!why,
            onclick: () => {
              close();
              void useComp(app, uid, onChange, document.querySelector('.comp-rail'));
            },
          },
          CONSUMABLES[inst.id].kind === 'cocktail' ? 'Drink' : 'Use',
        ),
        h(
          'button.btn.btn-danger',
          {
            onclick: () => {
              app.act(() => sellConsumable(run, uid));
              sfx.sell();
              close();
              onChange();
            },
          },
          'Sell $1',
        ),
      ),
      why ? h('p.err', why) : null,
    ),
  );
}
