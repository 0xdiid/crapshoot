import { anteTables, cupDice, BOSSES, FINAL_ANTE, FINAL_BOSS, limits, startTable } from '../engine';
import type { App, ScreenView } from './app';
import { sfx } from './audio';
import { bossTip, dieTip, rich } from './cards';
import { win } from './chrome';
import { openDiceBox } from './dicebox';
import { dieEl } from './die';
import { fmtShort, h } from './dom';
import { charmRail, compRail, gameBar } from './hud';
import { px } from './icons';
import { openPaytable } from './menus';
import { tip } from './tooltip';

export function boardScreen(app: App): ScreenView {
  const el = h('div.screen.board-screen.stage');

  function render() {
    const run = app.run!;
    const tables = anteTables(run);
    const play = () => {
      sfx.shake();
      if (app.act(() => startTable(run)) !== undefined) app.sync();
    };
    const cards = tables.map((t) => {
      const done = t.index < run.tableIndex;
      const current = t.index === run.tableIndex;
      const boss = t.boss ? (t.boss.id === FINAL_BOSS.id ? FINAL_BOSS : BOSSES[t.boss.id]) : null;
      return h(
        'div.table-card',
        { class: { done, current, future: !done && !current, boss: !!boss } },
        h(
          'div.tc-felt',
          h('div.tc-name', t.name),
          h('div.tc-target', h('small', 'Target'), h('b', fmtShort(t.target))),
        ),
        boss
          ? tip(
              h(
                'div.tc-boss',
                px(boss.icon, 40, 20),
                h(
                  'div',
                  h('b', boss.name),
                  t.boss!.rules.map((r) => h('div.tc-rule', rich(BOSSES[r].desc))),
                ),
              ),
              () => bossTip(t.boss!.id, t.boss!.rules),
            )
          : h('div.tc-plain', t.index === 0 ? 'Warm-up table. No house rules.' : 'Bigger target, bigger payout.'),
        h(
          'div.tc-meta',
          h('span', `${t.throws} throws`),
          h('span', `${t.rerolls} rerolls`),
          t.cupSize !== limits(run).cupSize ? h('span.bad', `${t.cupSize} dice`) : null,
          h('span', `Pays $${t.reward}`),
        ),
        done ? h('div.stamp', 'PAID') : null,
        current ? h('button.btn.btn-primary.btn-wide', { onclick: play }, 'Play') : null,
      );
    });

    const cup = cupDice(run);
    el.replaceChildren(
      gameBar(app, [
        { label: run.endless ? 'Endless' : 'Ante', value: run.endless ? String(run.ante) : `${run.ante} of ${FINAL_ANTE}` },
        { label: 'Next up', value: tables[run.tableIndex].name },
      ]),
      win(
        'Tonight\'s tables',
        [h('div.board-tables', cards)],
        {
          cls: 'board-win',
        },
      ),
      h(
        'div.board-bottom',
        win(
          `Cup ${cup.length}/${limits(run).cupSize}`,
          [
            h(
              'div.bowl-mini',
              cup.map((d) => tip(dieEl(d, { size: 44 }), () => dieTip(d))),
            ),
            h(
              'div.row',
              h(
                'button.btn',
                { onclick: () => (sfx.click(), openDiceBox(app, render)) },
                `Dice Box (${run.box.length})`,
              ),
              h('button.btn', { onclick: () => (sfx.click(), openPaytable(app)) }, 'Hands'),
            ),
          ],
          { palette: true, cls: 'bowl-pal' },
        ),
        charmRail(app, render),
        compRail(app, render),
      ),
    );
    if (run.ante === 1 && run.tableIndex === 0) {
      requestAnimationFrame(
        () =>
          app.viewKey === 'board' &&
          app.hint(
          'board',
          el.querySelector('.table-card.current'),
          'Each ante has three tables. Hit the target score before your Throws run out. The third table has a Pit Boss rule.',
          'bottom',
        ),
      );
    }
  }
  render();
  const onKey = (e: KeyboardEvent) => {
    if (app.hasModal() || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    (el.querySelector('.table-card.current .btn-primary') as HTMLElement | null)?.click();
  };
  addEventListener('keydown', onKey);
  return {
    el,
    update: render,
    destroy: () => {
      removeEventListener('keydown', onKey);
      app.clearHints();
    },
  };
}
