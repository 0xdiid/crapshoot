import { CHARMS, HAND_ORDER, HANDS, PROFILES, STAKES, continueEndless, currentBossName } from '../engine';
import type { App, ScreenView } from './app';
import { sfx } from './audio';
import { charmTip } from './cards';
import { fmt, h } from './dom';
import { confetti } from './fx';
import { win } from './chrome';
import { HAPPY_DIE, BUST_DIE, bitmap, px } from './icons';
import { outlineTitle } from './menus';
import { tip } from './tooltip';

export function endScreen(app: App): ScreenView {
  const run = app.run!;
  const won = run.phase === 'victory';
  const t = run.table;
  const most = [...HAND_ORDER].sort((a, b) => run.stats.hands[b] - run.stats.hands[a])[0];
  const biggest = [...HAND_ORDER].reverse().find((x) => run.stats.hands[x] > 0);
  const prof = PROFILES.find((p) => p.id === run.profileId)!;
  const stat = (label: string, value: string) => h('div.stat', h('small', label), h('b', value));

  const actions = won
    ? [
        h(
          'button.btn.btn-primary.btn-big',
          {
            onclick: () => {
              sfx.select();
              app.act(() => continueEndless(run));
              app.sync();
            },
          },
          'Keep throwing (endless)',
        ),
        h(
          'button.btn.btn-big',
          {
            onclick: () => {
              app.run = null;
              app.save();
              app.go('title');
            },
          },
          'Cash in',
        ),
      ]
    : [
        h(
          'button.btn.btn-primary.btn-big',
          { onclick: () => (sfx.shake(), app.startRun(run.profileId, run.stake)) },
          'Run it back',
        ),
        h('button.btn.btn-big', { onclick: () => ((app.run = null), app.go('setup')) }, 'New shooter'),
        h('button.btn', { onclick: () => ((app.run = null), app.go('title')) }, 'Main menu'),
      ];

  const el = h(
    'div.screen.end-screen.stage',
    { class: won ? 'won' : 'lost' },
    win(
      won ? 'Victory' : 'Run over',
      [
        h(
          'div.end-stack',
          h('div.end-mac', bitmap(won ? HAPPY_DIE : BUST_DIE, 100, 'px-icon mac-face')),
          outlineTitle(won ? 'Broke the House' : 'The House Wins', 'end-title'),
          h(
            'p.end-line',
            won
              ? `${prof.name} beat all eight antes on ${STAKES[run.stake].name}.`
              : t
                ? `${run.tableIndex === 2 ? `${currentBossName(run)} busted you` : `Busted at the ${['Low Roller', 'High Roller'][run.tableIndex]} table`} in ante ${run.ante}: ${fmt(t.score)} of ${fmt(t.target)}.`
                : `Busted in ante ${run.ante}.`,
          ),
          h(
            'div.stats',
            stat('Ante reached', String(run.ante)),
            stat('Tables won', String(run.stats.tablesWon)),
            stat('Throws', String(run.stats.throws)),
            stat('Rerolls', String(run.stats.rerolls)),
            stat('Best throw', fmt(run.stats.bestThrow)),
            stat('Favorite hand', run.stats.hands[most] ? HANDS[most].name : '-'),
            stat('Biggest hand', biggest ? HANDS[biggest].name : '-'),
            stat('Dice duplicated', String(run.stats.dupes)),
          ),
          run.charms.length
            ? h(
                'div.end-charms',
                run.charms.map((c) =>
                  tip(h('span.card-mini', px(CHARMS[c.id].icon, 48, 24)), () => charmTip(c.id, run, c)),
                ),
              )
            : null,
          h('div.end-actions', actions),
          h('div.muted.small', `Seed ${run.seed}`),
        ),
      ],
      { cls: 'end-win' },
    ),
  );
  if (won) {
    setTimeout(() => {
      confetti();
      sfx.win();
    }, 200);
    setTimeout(confetti, 1400);
  }
  return { el };
}
