import {
  CHARMS,
  CONSUMABLES,
  FACE_SETS,
  HAND_ORDER,
  HANDS,
  PROFILES,
  STAKES,
  UPGRADES,
  handValues,
  limits,
  type Die,
} from '../engine';
import type { App, ScreenView } from './app';
import { sfx } from './audio';
import { charmTip, consumableTip, handTip } from './cards';
import { logo, win } from './chrome';
import { dieEl, pips } from './die';
import { h } from './dom';
import { px } from './icons';
import { openRecords } from './records';
import { loadRun, meta, saveMeta, settings } from './store';
import { tip } from './tooltip';

function tumblingDie(v: number, cls: string) {
  const faces = [v, 7 - v, 2, 5, 3, 4].map((f, i) => h(`div.cf.cf${i}`, pips(f)));
  return h(`div.cube-wrap.deco.${cls}`, { style: { '--body': '#ffffff', '--pip': '#000000', '--s': '56px' } }, h('div.cube.spin', faces));
}

/** Big Chicago title set in the Mac "Outline" + "Shadow" styles. */
export function outlineTitle(text: string, cls = ''): HTMLElement {
  return h('div.mac-outline', { class: cls }, text);
}

// ---------- Title ----------

export function titleScreen(app: App): ScreenView {
  const save = loadRun();
  const start = () => (save ? app.continueRun() : app.go('setup'));
  const el = h(
    'div.screen.title-screen.stage',
    h(
      'div.title-stack',
      h('div.title-logo', logo('title-wordmark')),
      h('p.tagline', 'A dice roguelite. Build a cup of crooked dice, chase Full Houses and Five of a Kinds, and stack charms until the house breaks.'),
      h('div.title-dice', tumblingDie(6, 'd1'), tumblingDie(6, 'd2'), tumblingDie(6, 'd3')),
      win(
        save ? `Saved run: ante ${save.ante}` : 'Ready to roll',
        [
          h(
            'div.title-buttons',
            h(
              'button.btn.btn-primary.btn-big',
              { onclick: () => (sfx.select(), start()) },
              save ? 'Continue' : 'New Run',
            ),
            save
              ? h(
                  'button.btn.btn-big',
                  {
                    onclick: async () => {
                      sfx.select();
                      if (!(await app.confirm('Start a new run?', 'Your saved run will be lost.', 'New Run'))) return;
                      app.go('setup');
                    },
                  },
                  'New Run',
                )
              : null,
            h(
              'div.row',
              h('button.btn', { onclick: () => (sfx.click(), app.go('howto')) }, 'How to Play'),
              h('button.btn', { onclick: () => (sfx.click(), openRecords(app)) }, 'Records'),
              h('button.btn', { onclick: () => (sfx.click(), openSettings(app)) }, 'Settings'),
            ),
          ),
        ],
        { cls: 'title-panel' },
      ),
      meta.runs > 0
        ? h('div.title-stats', `${meta.runs} ${meta.runs === 1 ? 'run' : 'runs'} played, ${meta.wins} won${meta.bestAnte ? `, best ante ${meta.bestAnte}` : ''}`)
        : null,
    ),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !app.hasModal()) start();
  };
  addEventListener('keydown', onKey);
  return { el, destroy: () => removeEventListener('keydown', onKey) };
}

// ---------- Shooter select ----------

export function setupScreen(app: App): ScreenView {
  let profile = PROFILES[0].id;
  let stake = 0;
  let seed = '';
  const list = h('div.chooser-list');
  const detail = h('div.chooser-detail');

  const toDice = (p: (typeof PROFILES)[number]): Die[] =>
    p.dice.map((d, i) => ({ uid: `p${i}`, faceSet: d.faceSet, faces: [...FACE_SETS[d.faceSet].faces], mods: d.mods ?? [], hotChips: 0 }));

  function render() {
    list.replaceChildren(
      ...PROFILES.map((p) =>
        h(
          'button.chooser-item',
          {
            class: p.id === profile ? 'selected' : '',
            onclick: () => {
              profile = p.id;
              sfx.select();
              render();
            },
            ondblclick: () => go(),
          },
          px(p.icon, 48, 24),
          h('span', p.name),
        ),
      ),
    );
    const p = PROFILES.find((x) => x.id === profile)!;
    detail.replaceChildren(
      h('div.cd-head', px(p.icon, 64, 32), h('div', h('div.cd-name', p.name), h('div.cd-desc', p.desc))),
      h('fieldset.mac-group', h('legend', 'Starting Cup'), h('div.cd-dice', toDice(p).map((d) => dieEl(d, { size: 40 })))),
      h(
        'div.cd-facts',
        h('div', h('span.muted', 'Cash'), h('b', `$${p.money}`)),
        h(
          'div',
          h('span.muted', 'Charms'),
          (p.charms ?? []).length
            ? (p.charms ?? []).map((id) => tip(h('span.cd-charm', px(CHARMS[id].icon, 32, 16), CHARMS[id].name), () => charmTip(id, null)))
            : h('b', 'None'),
        ),
        p.consumables?.length
          ? h(
              'div',
              h('span.muted', 'Comps'),
              p.consumables.map((id) => tip(h('span.cd-charm', px(CONSUMABLES[id].icon, 32, 16), CONSUMABLES[id].name), () => consumableTip(id, null))),
            )
          : null,
        meta.profileWins[p.id] ? h('div', h('span.muted', 'Wins'), h('b', String(meta.profileWins[p.id]))) : null,
      ),
      h(
        'fieldset.mac-group',
        h('legend', 'Table stakes'),
        ...STAKES.map((st) => {
          const locked = st.id > meta.stakeUnlocked;
          return h(
            'label.mac-radio',
            { class: locked ? 'disabled' : '' },
            h('input', {
              type: 'radio',
              name: 'stake',
              checked: stake === st.id,
              disabled: locked,
              onchange: () => {
                stake = st.id;
                sfx.chip();
              },
            }),
            h('span.chip-disc', { style: { '--chip': st.color } }),
            h('span', h('b', st.name), ' ', h('span.muted', locked ? `Win on ${STAKES[st.id - 1].name} to unlock` : st.desc)),
          );
        }),
      ),
    );
  }

  const go = () => {
    sfx.shake();
    app.startRun(profile, stake, seed);
  };
  render();

  const seedInput = h('input.mac-field', {
    placeholder: 'Random',
    maxlength: 12,
    oninput: (e: Event) => (seed = (e.target as HTMLInputElement).value.trim()),
  });

  const el = h(
    'div.screen.setup-screen.stage',
    h('div.screen-head', h('button.btn', { onclick: () => app.go('title') }, 'Back'), logo('head-logo')),
    win(
      'Pick your shooter',
      [
        h('div.chooser', list, detail),
        h(
          'div.chooser-foot',
          h('label.seed', h('span', 'Seed'), seedInput),
          h('button.btn.btn-primary.btn-big', { onclick: go }, 'Deal Me In'),
        ),
      ],
      { cls: 'chooser-win' },
    ),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !app.hasModal() && (e.target as HTMLElement)?.tagName !== 'INPUT') go();
  };
  addEventListener('keydown', onKey);
  return { el, destroy: () => removeEventListener('keydown', onKey) };
}

// ---------- How to play ----------

const std = (): Die => ({ uid: 'a', faceSet: 'standard', faces: [1, 2, 3, 4, 5, 6], mods: [], hotChips: 0 });
const row = (faces: number[], held: number[] = []) =>
  h(
    'div.how-dice',
    faces.map((f, i) => dieEl(std(), { face: f, size: 40, cls: held.includes(i) ? 'selected' : '' })),
  );

const HOW = [
  {
    title: 'Throw the cup',
    body: 'Every Throw rolls all the dice in your Cup. You get 4 Throws per table to reach the target score.',
    art: () => h('div.how-art', row([3, 3, 5, 1, 3])),
  },
  {
    title: 'Hold and reroll',
    body: 'Tap dice to hold them, then Reroll the rest. Rerolls are a shared pool for the whole table, so spend them where they count.',
    art: () => h('div.how-art', row([3, 3, 5, 1, 3], [0, 1, 4]), h('div.how-callout.mac-outline', 'Reroll')),
  },
  {
    title: 'Score a hand',
    body: 'Pairs, Straights, Full Houses, Five of a Kind. Each hand has Chips x Mult, plus the pips of the dice that make it. Your best hand is picked for you, or tap another.',
    art: () => h('div.how-art', row([3, 3, 3, 3, 3]), h('div.how-callout.mac-outline', 'Five of a Kind')),
  },
  {
    title: 'Build the cup',
    body: 'Between tables, buy Charms, crooked Dice, Cocktails (level up a hand) and Tricks. Twin dice split in two, a bigger Cup unlocks six-dice hands. Beat the Pit Boss of Ante 8 to break the house.',
    art: () => h('div.how-art', h('div.how-charms', ['👯', '🍷', '🔮', '✌️'].map((i) => h('span.card-mini', px(i, 48, 24))))),
  },
];

export function howtoScreen(app: App): ScreenView {
  let i = 0;
  const body = h('div.how-body');
  const page = h('div.how-page');
  const prev = h('button.btn', { onclick: () => step(-1) }, 'Back');
  const next = h('button.btn.btn-primary', { onclick: () => step(1) }, 'Next');
  const leave = () => (app.run ? app.sync() : app.go('title'));
  function render() {
    const c = HOW[i];
    body.replaceChildren(h('div.how-card', h('div.how-felt', c.art()), h('h2', c.title), h('p', c.body)));
    page.textContent = `Page ${i + 1} of ${HOW.length}`;
    prev.toggleAttribute('disabled', i === 0);
    next.textContent = i === HOW.length - 1 ? 'Done' : 'Next';
  }
  function step(d: number) {
    sfx.flip();
    if (i + d >= HOW.length) return leave();
    i = Math.max(0, i + d);
    render();
  }
  render();
  const el = h(
    'div.screen.howto-screen.stage',
    h('div.screen-head', h('button.btn', { onclick: leave }, 'Back'), logo('head-logo')),
    win('How to play', [body, h('div.how-nav', page, h('div.row', prev, next))], { cls: 'readme-win' }),
  );
  return { el };
}

// ---------- Settings ----------

export function openSettings(app: App) {
  const slider = (label: string, key: 'sfx' | 'music') =>
    h(
      'label.set-row',
      h('span', label),
      h('input', {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.05,
        value: String(settings[key]),
        oninput: (e: Event) => {
          settings[key] = Number((e.target as HTMLInputElement).value);
          app.applySettings();
        },
        onchange: () => sfx.chip(),
      }),
    );
  const toggle = (label: string, key: 'shake' | 'reduced' | 'hints') =>
    h(
      'label.set-row',
      h('span', label),
      h('input', {
        type: 'checkbox',
        checked: settings[key],
        onchange: (e: Event) => {
          settings[key] = (e.target as HTMLInputElement).checked;
          app.applySettings();
          sfx.click();
        },
      }),
    );
  const speeds = h(
    'div.seg',
    ([1, 2, 3] as const).map((s) =>
      h(
        'button',
        {
          class: settings.speed === s ? 'on' : '',
          onclick: (e: MouseEvent) => {
            settings.speed = s;
            app.applySettings();
            sfx.click();
            speeds.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
            (e.currentTarget as HTMLElement).classList.add('on');
          },
        },
        s === 3 ? 'Turbo' : `${s}x`,
      ),
    ),
  );
  app.modal(
    h(
      'div.settings',
      h('h2', 'Settings'),
      slider('Sound effects', 'sfx'),
      slider('Music', 'music'),
      h('div.set-row', h('span', 'Game speed'), speeds),
      toggle('Screen shake', 'shake'),
      toggle('Reduced motion', 'reduced'),
      toggle('Show tips', 'hints'),
      h(
        'button.btn.btn-ghost',
        {
          onclick: () => {
            meta.seenHints = [];
            saveMeta();
            app.toast('Tips will show again', 'good');
          },
        },
        'Replay tips',
      ),
    ),
  );
}

// ---------- Paytable / run info ----------

export function openPaytable(app: App) {
  const run = app.run;
  if (!run) return;
  const cup = limits(run).cupSize + run.box.filter((d) => d.mods.includes('twin')).length;
  const rows = HAND_ORDER.map((id) => {
    const hd = HANDS[id];
    const lvl = run.levels[id];
    const v = handValues(id, lvl);
    const locked = hd.minDice > Math.max(5, cup) && !run.stats.hands[id];
    return tip(
      h(
        'tr',
        { class: locked ? 'locked' : '' },
        h('td', h('span.lvl', `Lv ${lvl}`)),
        h(
          'td',
          h('b', h('span.swatch', { style: { background: hd.color } }), locked ? '???' : hd.name),
          h('div.muted', locked ? `Needs ${hd.minDice} dice in a throw` : hd.desc),
        ),
        h('td.num', h('b.t-chips', String(v.chips)), ' x ', h('b.t-mult', String(v.mult))),
        h('td.num.muted', String(run.stats.hands[id])),
      ),
      () => (locked ? null : handTip(id, run)),
    );
  });
  app.modal(
    h(
      'div.paytable',
      h('h2', 'Hands'),
      h(
        'table',
        h('thead', h('tr', h('th', ''), h('th', 'Hand'), h('th.num', 'Chips x Mult'), h('th.num', 'Scored'))),
        h('tbody', rows),
      ),
      run.upgrades.length
        ? h(
            'div.upgrades-owned',
            h('h3', 'Upgrades'),
            run.upgrades.map((u) => h('span.pill', `${UPGRADES[u].icon} ${UPGRADES[u].name}`)),
          )
        : null,
      h('p.muted', 'A hand also adds the pips of the dice that make it. Cocktails level hands up.'),
    ),
  );
}

export function openPause(app: App) {
  let close = () => {};
  const item = (label: string, fn: () => void, cls = '') =>
    h(
      'button.btn.btn-wide',
      {
        class: cls,
        onclick: () => {
          sfx.click();
          close();
          fn();
        },
      },
      label,
    );
  close = app.modal(
    h(
      'div.pause',
      h('h2', 'Paused'),
      item('Resume', () => {}, 'btn-primary'),
      item('Hands', () => openPaytable(app)),
      item('How to play', () => app.go('howto')),
      item('Settings', () => openSettings(app)),
      item('Save and quit', () => app.quitToTitle()),
      item(
        'Abandon run',
        async () => {
          if (await app.confirm('Abandon this run?', 'It counts as a loss.', 'Abandon')) {
            app.recordEnd(false);
            app.run = null;
            app.save();
            app.go('title');
          }
        },
        'btn-danger',
      ),
    ),
  );
}
