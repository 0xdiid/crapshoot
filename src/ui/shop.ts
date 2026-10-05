import {
  CONSUMABLES,
  FACE_SETS,
  MODS,
  anteTables,
  buy,
  cantBuy,
  cantPick,
  dieName,
  leaveShop,
  limits,
  pickPackOption,
  restockShop,
  skipPack,
  PACKS,
  type PackOption,
  type ShopItem,
  type ShopRef,
} from '../engine';
import type { App, ScreenView } from './app';
import { sfx } from './audio';
import {
  charmCard,
  charmTip,
  consumableCard,
  consumableTip,
  dieTip,
  levelName,
  packCard,
  packTip,
  rich,
  upgradeCard,
  upgradeTip,
} from './cards';
import { openDiceBox, pickDie } from './dicebox';
import { dieEl, faceStrip } from './die';
import { center, fmtShort, h, pulse } from './dom';
import { burst, floatText } from './fx';
import { charmRail, compRail, gameBar } from './hud';
import { tip } from './tooltip';
import { px } from './icons';
import { win } from './chrome';

function dieCard(
  item: Extract<ShopItem, { kind: 'die' }> | { die: Extract<PackOption, { kind: 'die' }>['die'] },
  price?: number,
) {
  const d = item.die;
  return h(
    'div.card.card-die.card-md',
    h(
      'div.card-inner',
      h('div.card-die-show', dieEl(d, { size: 60 })),
      h('div.card-name', dieName(d)),
      faceStrip(d, 16),
      h(
        'div.card-desc',
        d.mods.length
          ? d.mods.map((m) => h('div', h('b', MODS[m].name), ' ', rich(MODS[m].desc)))
          : rich(FACE_SETS[d.faceSet].desc),
      ),
      h('div.card-sub', 'Die'),
    ),
    price !== undefined ? h('div.price-tag', `$${price}`) : null,
  );
}

export function shopScreen(app: App): ScreenView {
  const el = h('div.screen.shop-screen.stage');

  function itemCard(item: ShopItem): HTMLElement {
    switch (item.kind) {
      case 'charm':
        return tip(charmCard(item.id, { price: item.price, desc: true }), () => charmTip(item.id, app.run));
      case 'consumable':
        return tip(consumableCard(item.id, { price: item.price, desc: true }), () => consumableTip(item.id, app.run));
      case 'die':
        return tip(dieCard(item, item.price), () => dieTip(item.die));
      case 'pack':
        return tip(packCard(item.id, { price: item.price, desc: true }), () => packTip(item.id));
      case 'upgrade':
        return tip(upgradeCard(item.id, { price: item.price, desc: true }), () => upgradeTip(item.id));
    }
  }

  function slot(item: ShopItem | null, ref: ShopRef) {
    if (!item) return h('div.shop-slot.empty');
    const run = app.run!;
    const card = itemCard(item);
    if (item.sold) return h('div.shop-slot.sold', card, h('div.sold-stamp', 'SOLD'));
    const why = cantBuy(run, item);
    const btn = h(
      'button.btn.btn-buy',
      {
        class: why ? 'cant' : '',
        onclick: () => {
          if (why) {
            sfx.deny();
            app.toast(why, 'bad');
            pulse(btn, 'shake-x');
            return;
          }
          const bought = app.act(() => buy(run, ref));
          if (!bought) return;
          sfx.buy();
          const c = center(card);
          burst(c.x, c.y, 'coin', 10, ['#fcf305'], 5);
          floatText(c.x, c.y - 40, `-$${bought.price}`, 'bad');
          render();
          if (bought.kind === 'pack') openPack();
          else if (bought.kind === 'charm') {
            const last = el.querySelector(
              '.charm-rail .charm-slot:not(.empty):last-of-type .charm',
            ) as HTMLElement | null;
            const all = el.querySelectorAll('.charm-rail .charm');
            const newest = (all[all.length - 1] as HTMLElement) ?? last;
            if (newest) pulse(newest, 'arrive');
          }
        },
      },
      item.kind === 'pack' ? 'Open' : 'Buy',
      h('b', `$${item.price}`),
    );
    if (why) btn.title = why;
    return h('div.shop-slot', card, btn);
  }

  function render() {
    const run = app.run!;
    const s = run.shop!;
    const next = anteTables(run)[run.tableIndex];
    const reroll = h(
      'button.btn',
      {
        class: run.money < s.restockCost ? 'cant' : '',
        onclick: () => {
          if (run.money < s.restockCost) {
            sfx.deny();
            return app.toast('Not enough money', 'bad');
          }
          if (!app.ok(() => restockShop(run))) return;
          sfx.shake();
          render();
          el.querySelectorAll('.shop-sec:first-of-type .card').forEach((c, i) => {
            (c as HTMLElement).style.animationDelay = `${i * 60}ms`;
            pulse(c, 'deal');
          });
        },
      },
      `Restock $${s.restockCost}`,
    );
    el.replaceChildren(
      gameBar(app, [
        { label: 'Ante', value: String(run.ante) },
        { label: 'Next up', value: `${next.name}, ${fmtShort(next.target)}` },
      ]),
      h('div.shop-rails', charmRail(app, render), compRail(app, render)),
      win(
        'The Back Room',
        [
          h(
            'div.shop-floor',
            h(
              'section.shop-sec',
              h('div.section-title', 'For sale'),
              h(
                'div.shop-row',
                s.items.map((it, i) => slot(it, { group: 'items', index: i })),
                s.dice.map((it, i) => slot(it, { group: 'dice', index: i })),
              ),
            ),
            h(
              'section.shop-sec',
              h('div.section-title', 'Packs and upgrades'),
              h(
                'div.shop-row',
                s.packs.map((it, i) => slot(it, { group: 'packs', index: i })),
                s.upgrade ? slot(s.upgrade, { group: 'upgrade', index: 0 }) : null,
              ),
            ),
          ),
          h(
            'footer.shop-foot',
            reroll,
            h('button.btn', { onclick: () => (sfx.click(), openDiceBox(app, render)) }, `Dice Box (${run.box.length})`),
            h(
              'button.btn.btn-primary',
              {
                onclick: () => {
                  sfx.select();
                  if (app.ok(() => leaveShop(run))) app.sync();
                },
              },
              'Next Table',
            ),
          ),
        ],
        { cls: 'shop-win' },
      ),
    );
    el.querySelectorAll('.shop-floor .card').forEach((c, i) => {
      (c as HTMLElement).style.animationDelay = `${i * 50}ms`;
    });
    requestAnimationFrame(() =>
      app.hint(
        'shop',
        el.querySelector('.shop-floor .card'),
        'Charms trigger on every Throw, left to right. Hover or long-press anything to read it.',
        'bottom',
      ),
    );
  }

  function openPack() {
    const run = app.run!;
    const pack = run.shop!.openPack;
    if (!pack) return;
    const def = PACKS[pack.packId];
    const grid = h('div.pack-grid');
    const railBox = h('div.pack-rail');
    let flipped = false;
    let close = () => {};
    const renderOptions = () => {
      grid.replaceChildren(
        ...pack.options.map((o, i) => {
          let card: HTMLElement;
          if (o.kind === 'charm') card = tip(charmCard(o.id, { desc: true }), () => charmTip(o.id, run));
          else if (o.kind === 'consumable')
            card = tip(consumableCard(o.id, { desc: true }), () => consumableTip(o.id, run));
          else card = tip(dieCard(o), () => dieTip(o.die));
          const wrap = h(
            'div.pack-opt',
            { style: { animationDelay: `${i * 160}ms` } },
            h('div.flip', h('div.flip-back', px(def.icon, 64, 32)), h('div.flip-front', card)),
          );
          const btn = h(
            'button.btn.btn-primary',
            {
              onclick: async () => {
                let dieUid: string | undefined;
                if (o.kind === 'consumable' && CONSUMABLES[o.id].kind === 'token') {
                  const pickedDie = await pickDie(app, `${CONSUMABLES[o.id].name}: pick a die`, run.box, (u) =>
                    cantPick(run, i, u),
                  );
                  if (!pickedDie) return;
                  dieUid = pickedDie;
                }
                const why = cantPick(run, i, dieUid);
                if (why) {
                  sfx.deny();
                  return app.toast(why, 'bad');
                }
                const beforeLevels = { ...run.levels };
                if (app.act(() => pickPackOption(run, i, dieUid)) === undefined) return;
                const c = center(card);
                if (o.kind === 'consumable' && CONSUMABLES[o.id].kind === 'cocktail') {
                  const lv = (CONSUMABLES[o.id] as { level: keyof typeof run.levels }).level;
                  sfx.levelUp();
                  floatText(c.x, c.y - 30, `${levelName(lv)} Lv ${run.levels[lv]}`, 'note', true);
                  if (run.levels[lv] - beforeLevels[lv] > 1) app.toast('Mixologist: double pour!', 'good');
                } else sfx.buy();
                burst(c.x, c.y, 'star', 20, [def.color, '#fff'], 6);
                if (!run.shop!.openPack) {
                  close();
                  render();
                } else renderOptions();
              },
            },
            o.kind === 'consumable' && CONSUMABLES[o.id].kind === 'cocktail' ? 'Drink' : 'Take',
          );
          const blocked = o.kind === 'consumable' && CONSUMABLES[o.id].kind === 'token' ? null : cantPick(run, i);
          if (blocked) {
            btn.setAttribute('disabled', '');
            btn.textContent = blocked;
          }
          return h('div.pack-col', wrap, btn);
        }),
      );
      if (flipped) grid.querySelectorAll('.pack-opt').forEach((w) => w.classList.add('flipped', 'no-deal'));
      else
        grid
          .querySelectorAll('.pack-opt')
          .forEach((w, i) => setTimeout(() => (w.classList.add('flipped'), sfx.flip()), app.ms(300 + i * 220)));
      flipped = true;
      if (def.contents === 'charm' || def.contents === 'die') {
        const full =
          def.contents === 'charm'
            ? run.charms.length >= limits(run).charmSlots
            : run.box.length >= limits(run).boxSize;
        const again = () => (render(), renderOptions());
        railBox.replaceChildren(
          full
            ? h(
                'p.err',
                def.contents === 'charm'
                  ? 'Charm slots are full. Sell one to make room.'
                  : 'Your Dice Box is full. Sell or fuse a die to make room.',
              )
            : '',
          def.contents === 'charm'
            ? charmRail(app, again)
            : h('button.btn', { onclick: () => openDiceBox(app, again) }, 'Open Dice Box'),
        );
      }
    };
    renderOptions();
    close = app.modal(
      h(
        'div.pack-open',
        { style: { '--accent': def.color } },
        h('h2', h('span.h2-icon', px(def.icon, 32, 32)), def.name),
        h('p.muted', def.desc),
        grid,
        railBox,
        h(
          'button.btn.btn-ghost',
          {
            onclick: () => {
              app.act(() => skipPack(run));
              close();
              render();
            },
          },
          'Skip',
        ),
      ),
      { dismissable: false, cls: 'wide' },
    );
  }

  render();
  if (app.run?.shop?.openPack) requestAnimationFrame(openPack);
  return { el, update: render, destroy: () => app.clearHints() };
}
