import {
  BOSSES,
  FINAL_BOSS,
  HANDS,
  TABLE_NAMES,
  WILD,
  canThrow,
  cantReroll,
  cantScore,
  collectPayout,
  cupDice,
  getDie,
  handOptions,
  handValues,
  isFinalWin,
  mirroredFaces,
  reroll,
  scoreThrow,
  throwCup,
  toggleHold,
  type Die,
  type HandId,
  type HandOption,
  type ScoreReport,
  type ScoreStep,
  type TableDie,
  type ThrowReport,
} from '../engine';
import type { App, ScreenView } from './app';
import { sfx } from './audio';
import { setMusicIntensity } from './music';
import { bossTip, dieTip, handTip } from './cards';
import { cube, dieEl, faceIndexFor, type Cube } from './die';
import { center, fmt, fmtMult, h, pulse, sleep } from './dom';
import { burst, confetti, floatText, shake, stream } from './fx';
import { charmRail, compRail, gameBar } from './hud';
import { win } from './chrome';
import { HAPPY_DIE, BUST_DIE, bitmap } from './icons';
import { openPaytable } from './menus';
import { tip } from './tooltip';

interface Callout {
  text: string;
  sub: string;
  color: string;
  tier: number;
  icon?: Node;
}

const HAND_TIER: Record<HandId, number> = {
  high: 0,
  pair: 0,
  twopair: 1,
  three: 1,
  smallstr: 1,
  fullhouse: 2,
  largestr: 2,
  four: 2,
  threepair: 2,
  five: 3,
  twotrips: 3,
  grand: 3,
  six: 3,
};

const SUBS: Partial<Record<HandId, string>> = {
  five: 'Five of a kind!',
  six: 'Six of a kind!',
  grand: 'One through six!',
};

interface Slot {
  id: string;
  cube: Cube;
  wrap: HTMLElement;
  plate: HTMLElement;
  fi: number;
  shown: number;
}

export function tableScreen(app: App): ScreenView {
  // Pinned so in-flight animations never see a swapped or cleared run.
  const R = app.run!;
  const T = R.table!;
  let skip = false;
  let destroyed = false;
  let slots: Slot[] = [];
  let chosen: HandId | null = null;
  let picking: { resolve: (id: string | null) => void; why: (id: string) => string | null } | null = null;
  // True while dice tumble, so the hand isn't revealed before they land.
  let rolling = false;

  // ---------- Static layout ----------
  const els = {
    title: h('span'),
    score: h('div.sb-score-val', '0'),
    scoreTarget: h('div.sb-score-target'),
    scoreBar: h('div.sb-bar-fill'),
    handName: h('div.sb-hand-name'),
    handLvl: h('div.sb-hand-lvl'),
    handBlock: h('div.sb-block.sb-hand'),
    chips: h('div.calc-chips', '0'),
    mult: h('div.calc-mult', '0'),
    calcResult: h('div.calc-result'),
    calc: h('div.sb-calc'),
    throws: h('div.count-pips'),
    throwsLabel: h('div.count-label'),
    rerolls: h('div.count-pips.rr'),
    rerollsLabel: h('div.count-label'),
    history: h('div.history'),
    boss: h('div.sb-boss'),
    felt: h('main.felt'),
    zone: h('div.dice-zone'),
    callout: h('div.callout'),
    banner: h('div.pick-banner.hidden'),
    rails: h('div.table-rails'),
    tray: h('div.tray'),
    opts: h('div.hand-opts'),
    reroll: h('button.btn.btn-reroll'),
    main: h('button.btn.btn-roll'),
  };

  els.calc.append(h('div.calc-row', els.chips, h('span.calc-x', '×'), els.mult), els.calcResult);
  els.handBlock.append(h('div.sb-hand-head', els.handName, els.handLvl), els.calc);

  const backwall = h('div.backwall');
  els.felt.append(
    backwall,
    h('div.felt-print', h('span.print-big', 'CRAPSHOOT'), h('span.print-line', 'HOLD AND REROLL')),
    els.zone,
    els.callout,
    els.banner,
  );
  els.felt.addEventListener('click', (e) => {
    if (app.busy) skip = true;
    else if (picking && e.target === els.felt) cancelPick();
  });
  els.reroll.addEventListener('click', () => void doReroll());
  els.main.addEventListener('click', () => void (T.dice ? doScore() : doThrow()));

  const bar = h('div.hud-slot');
  const el = h(
    'div.screen.table-screen.stage',
    bar,
    h(
      'div.table-layout',
      h(
        'aside.scoreboard',
        win(
          'Scoreboard',
          [
            h(
              'div.sb-block.sb-score',
              h('div.sb-label', 'Score'),
              els.score,
              els.scoreTarget,
              h('div.sb-bar', els.scoreBar),
            ),
            els.handBlock,
            h(
              'div.sb-block.sb-counts',
              h('div.count', els.throwsLabel, els.throws),
              h('div.count', els.rerollsLabel, els.rerolls),
            ),
            els.history,
            els.boss,
            h('button.btn.btn-small.paytable-btn', { onclick: () => openPaytable(app) }, 'Hands…'),
          ],
          { palette: true, cls: 'sb-win' },
        ),
      ),
      h('div.felt-col', win(els.title, [els.felt], { cls: 'felt-win' }), els.rails),
    ),
    h(
      'footer.bowl-bar',
      win(
        'Your hand',
        [h('div.bowl-inner', h('div.tray-wrap', els.tray, els.opts), h('div.actions', els.reroll, els.main))],
        {
          cls: 'bowl-win',
        },
      ),
    ),
  );

  // ---------- Refresh from state ----------

  function refreshRails() {
    els.rails.replaceChildren(charmRail(app, refreshAll, { sell: true }), compRail(app, refreshAll));
  }

  function options(): HandOption[] {
    return T.dice ? handOptions(R) : [];
  }

  function current(opts = options()): HandOption | null {
    return opts.find((o) => o.hand === chosen) ?? opts[0] ?? null;
  }

  function refreshTray() {
    if (T.dice) {
      els.tray.replaceChildren();
      els.tray.classList.add('hidden');
      const opts = options();
      const cur = current(opts);
      els.opts.classList.remove('hidden');
      els.opts.replaceChildren(
        ...opts.map((o) => {
          const hd = HANDS[o.hand];
          const b = h(
            'button.hand-opt',
            {
              class: `${o === cur ? 'on' : ''} ${o.voided ? 'void' : ''}`,
              style: { '--c': hd.color },
              onclick: () => {
                if (app.busy) return;
                chosen = o.hand;
                sfx.select();
                refreshTray();
                refreshHandBlock();
                refreshLit();
                refreshButtons();
              },
            },
            h('span.hand-swatch'),
            h('span.hand-opt-name', hd.name),
            h('b.hand-opt-val', o.voided ? '0' : fmt(o.preview)),
          );
          tip(b, () =>
            o.voided
              ? h('div.tip', h('div.tip-name', hd.name), h('div.tip-body', `${o.voided}: scores nothing`))
              : handTip(o.hand, R),
          );
          return b;
        }),
      );
    } else {
      els.opts.classList.add('hidden');
      els.tray.classList.remove('hidden');
      const dice = cupDice(R).slice(0, T.cupSize);
      els.tray.replaceChildren(
        h('span.tray-label', 'Cup'),
        ...dice.map((d) =>
          tip(dieEl(d, { size: 44 }), () => dieTip(d, { standard: T.bossRules.includes('house_dice') })),
        ),
        ...(T.cupSize > R.cup.length
          ? [h('span.tray-empty', `${T.cupSize - R.cup.length} empty slot${T.cupSize - R.cup.length === 1 ? '' : 's'}`)]
          : []),
      );
    }
  }

  function refreshHandBlock() {
    const cur = rolling ? null : current();
    if (!cur) {
      els.handName.textContent = rolling ? 'Rolling…' : T.throwsLeft > 0 ? 'Throw the dice' : '';
      els.handLvl.textContent = '';
      els.handBlock.style.setProperty('--c', '#c0c0c0');
      els.chips.textContent = '0';
      els.mult.textContent = '0';
      return;
    }
    const v = handValues(cur.hand, R.levels[cur.hand]);
    els.handName.textContent = HANDS[cur.hand].name;
    els.handLvl.textContent = `Lv ${R.levels[cur.hand]}`;
    els.handBlock.style.setProperty('--c', HANDS[cur.hand].color);
    els.chips.textContent = fmt(v.chips);
    els.mult.textContent = fmtMult(v.mult);
  }

  function pips(elx: HTMLElement, left: number, used: number, cls: string) {
    elx.replaceChildren(...Array.from({ length: left + used }, (_, i) => h('i', { class: i < used ? 'used' : cls })));
  }

  function refreshScoreboard() {
    bar.replaceChildren(
      gameBar(app, [
        { label: R.endless ? 'Endless' : 'Ante', value: R.endless ? String(R.ante) : `${R.ante} of 8` },
        { label: 'Table', value: TABLE_NAMES[R.tableIndex] },
        { label: 'Target', value: fmt(T.target), cls: 'hud-target' },
      ]),
    );
    setScore(T.score);
    els.scoreTarget.textContent = `of ${fmt(T.target)}`;
    els.throwsLabel.textContent = `${T.throwsLeft} Throw${T.throwsLeft === 1 ? '' : 's'}`;
    els.rerollsLabel.textContent = `${T.rerollsLeft} Reroll${T.rerollsLeft === 1 ? '' : 's'}`;
    pips(els.throws, T.throwsLeft, T.throwsUsed, T.throwsLeft === 1 ? 'last' : '');
    pips(els.rerolls, T.rerollsLeft, T.rerollsUsed, '');
    els.history.replaceChildren(
      ...T.history.map((x) =>
        h('span.hist', { style: { '--c': HANDS[x.hand].color } }, h('small', HANDS[x.hand].name), h('b', fmt(x.score))),
      ),
    );
    if (T.bossId) {
      const def = T.bossId === FINAL_BOSS.id ? FINAL_BOSS : BOSSES[T.bossId];
      els.boss.replaceChildren(
        tip(
          h(
            'div.boss-badge',
            { style: { '--boss': def.color } },
            h('span', def.icon),
            h(
              'div',
              h('b', def.name),
              T.bossRules.map((x) => h('small', BOSSES[x].desc)),
            ),
          ),
          () => bossTip(T.bossId!, T.bossRules),
        ),
      );
    } else els.boss.replaceChildren();
    const n = T.throwsUsed + (T.dice ? 1 : 0);
    els.title.textContent = picking
      ? 'Pick a die'
      : T.dice
        ? `Throw ${Math.max(1, n)} of ${T.throwsUsed + T.throwsLeft}`
        : T.finished
          ? 'Table over'
          : `Throw ${T.throwsUsed + 1} of ${T.throwsUsed + T.throwsLeft}`;
    refreshHandBlock();
    refreshButtons();
  }

  function refreshButtons() {
    const busy = app.busy || !!picking;
    const why = cantReroll(R);
    els.reroll.replaceChildren(
      h('b', 'Reroll'),
      h(
        'small',
        T.dice ? (why && why !== 'Every die is held' ? why : `${T.rerollsLeft} left`) : `${T.rerollsLeft} left`,
      ),
    );
    els.reroll.toggleAttribute('disabled', busy || !!why);
    if (T.dice) {
      const cur = rolling ? null : current();
      els.main.replaceChildren(
        h('small', cur ? `Score ${cur.voided ? 0 : fmt(cur.preview)}` : 'Score'),
        h('b', cur ? HANDS[cur.hand].name : '…'),
      );
      els.main.classList.add('scoring');
      els.main.toggleAttribute('disabled', busy || !!cantScore(R));
    } else {
      els.main.replaceChildren(h('b', 'Throw'));
      els.main.classList.remove('scoring');
      els.main.toggleAttribute('disabled', busy || !!canThrow(R));
    }
    el.classList.toggle('busy', app.busy);
    document.body.classList.toggle('busy', app.busy);
  }

  function refreshAll() {
    if (destroyed || !app.run || !app.run.table) return;
    refreshScoreboard();
    refreshTray();
    syncCubes(false);
    refreshRails();
    app.notify();
  }

  // ---------- Animated values ----------

  let shownScore = 0;

  function setScore(v: number) {
    if (destroyed) return;
    shownScore = v;
    els.score.textContent = fmt(v);
    const f = Math.min(1, v / T.target);
    els.scoreBar.style.width = `${f * 100}%`;
    els.scoreBar.classList.toggle('full', f >= 1);
    setMusicIntensity(f);
  }

  function countTo(from: number, to: number, ms: number, set: (v: number) => void) {
    return new Promise<void>((res) => {
      if (skip || ms <= 0 || from === to) {
        set(to);
        return res();
      }
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - start) / ms));
        const e = 1 - Math.pow(1 - k, 3);
        set(Math.round(from + (to - from) * e));
        if (k < 1 && !skip) requestAnimationFrame(tick);
        else {
          set(to);
          res();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  const wait = (ms: number) => (skip ? Promise.resolve() : sleep(app.ms(ms)));

  function flyNumber(from: Element, to: Element, text: string, cls: string) {
    return new Promise<void>((res) => {
      const a = center(from);
      const b = center(to);
      const n = h('div.fly-num', { class: cls }, text);
      document.body.appendChild(n);
      n.style.left = `${a.x}px`;
      n.style.top = `${a.y}px`;
      const anim = n.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${(b.x - a.x) * 0.5}px), calc(-50% + ${(b.y - a.y) * 0.5 - 40}px)) scale(1.1)`,
            opacity: 1,
            offset: 0.5,
          },
          { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(0.6)`, opacity: 0.2 },
        ],
        { duration: skip ? 1 : app.ms(420), easing: 'cubic-bezier(.5,0,.6,1)' },
      );
      anim.onfinish = () => {
        n.remove();
        res();
      };
    });
  }

  // ---------- Dice on the felt ----------

  const std = () => T.bossRules.includes('house_dice');
  const dieOf = (d: TableDie): Die =>
    getDie(R, d.uid) ?? { uid: d.uid, faceSet: 'standard', faces: [1, 2, 3, 4, 5, 6], mods: [], hotChips: 0 };

  function metrics(n: number) {
    const zr = els.zone.getBoundingClientRect();
    const size = Math.max(40, Math.min(84, (zr.width / Math.max(n, 5)) * 0.62));
    const gap = Math.min(zr.width / n, size * 1.6);
    const x0 = zr.width / 2 - (gap * (n - 1)) / 2;
    return {
      zr,
      size,
      pos: (i: number, held: boolean) => ({ x: x0 + gap * i, y: zr.height * 0.48 + (held ? size * 0.5 : 0) }),
    };
  }

  /** Faces as the player should see them: Mirror dice show what they copy. */
  function shownFaces(): number[] {
    return T.dice ? mirroredFaces(R, T.dice).faces : [];
  }

  function place(s: Slot, x: number, y: number, size: number) {
    s.wrap.style.setProperty('--s', `${size}px`);
    s.wrap.style.left = `${x - size / 2}px`;
    s.wrap.style.top = `${y - size / 2}px`;
    s.plate.style.left = `${x}px`;
    s.plate.style.top = `${y + size * 0.62}px`;
  }

  function makeSlot(d: TableDie, face: number, size: number, index: number): Slot {
    const die = dieOf(d);
    const c = cube(die, size, std());
    const fi = faceIndexFor(die, face, std());
    if ((std() ? [1, 2, 3, 4, 5, 6] : die.faces)[fi] !== face) c.setFace(fi, face);
    c.body.style.transform = c.orient(fi, 0, Math.random() * 16 - 8);
    const plate = h('div.hold-plate');
    const s: Slot = { id: d.id, cube: c, wrap: c.el, plate, fi, shown: face };
    c.el.classList.add('felt-die');
    c.el.addEventListener('click', (e) => {
      e.stopPropagation();
      onDieClick(d.id);
    });
    tip(c.el, () => dieTip(die, { standard: std() }));
    void index;
    return s;
  }

  function setShown(s: Slot, d: TableDie, face: number, animate: boolean) {
    if (s.shown === face) return;
    const die = dieOf(d);
    const fi = faceIndexFor(die, face, std());
    if ((std() ? [1, 2, 3, 4, 5, 6] : die.faces)[fi] !== face) s.cube.setFace(fi, face);
    const to = s.cube.orient(fi, 0, Math.random() * 16 - 8);
    if (animate && !skip) {
      s.cube.body.getAnimations().forEach((a) => a.cancel());
      s.cube.body.animate([{ transform: s.cube.orient(s.fi, 0, 0) }, { transform: s.cube.orient(fi, 1, 0) }], {
        duration: app.ms(380),
        easing: 'cubic-bezier(.2,.7,.25,1)',
      });
    }
    s.cube.body.style.transform = to;
    s.fi = fi;
    s.shown = face;
  }

  /** Brings the cubes in line with the table dice (faces, holds, order). */
  function syncCubes(animate: boolean) {
    const dice = T.dice ?? [];
    for (const s of slots) {
      if (dice.some((d) => d.id === s.id)) continue;
      s.wrap.remove();
      s.plate.remove();
    }
    slots = slots.filter((s) => dice.some((d) => d.id === s.id));
    const m = metrics(dice.length);
    if (m.zr.width === 0) return;
    const faces = shownFaces();
    dice.forEach((d, i) => {
      let s = slots.find((x) => x.id === d.id);
      const p = m.pos(i, d.held);
      if (!s) {
        s = makeSlot(d, faces[i], m.size, i);
        place(s, p.x, p.y, m.size);
        els.zone.append(s.wrap, s.plate);
        slots.push(s);
      }
      setShown(s, d, faces[i], animate);
      place(s, p.x, p.y, m.size);
      s.wrap.classList.toggle('held', d.held);
      s.wrap.classList.toggle('temp', d.temp);
      s.plate.className = `hold-plate ${d.held ? 'held' : ''} ${d.temp ? 'temp' : ''}`;
      s.plate.textContent = d.held ? 'HOLD' : d.temp ? 'COPY' : String(i + 1);
    });
    slots.sort((a, b) => dice.findIndex((d) => d.id === a.id) - dice.findIndex((d) => d.id === b.id));
    refreshLit();
  }

  function refreshLit() {
    const cur = rolling ? null : current();
    const lit = new Set(cur?.lit ?? []);
    slots.forEach((s, i) => {
      s.wrap.classList.toggle('lit', !!cur && lit.has(i));
      s.plate.classList.toggle('lit', !!cur && lit.has(i));
    });
  }

  function clearCubes() {
    for (const s of slots) {
      s.wrap.classList.add('gone');
      s.plate.remove();
      const w = s.wrap;
      setTimeout(() => w.remove(), 300);
    }
    slots = [];
  }

  function onDieClick(id: string) {
    if (picking) {
      const why = picking.why(id);
      if (why) {
        app.toast(why, 'bad');
        sfx.deny();
        return;
      }
      const p = picking;
      endPick();
      p.resolve(id);
      return;
    }
    if (app.busy || !T.dice) return;
    const d = T.dice.find((x) => x.id === id);
    if (!d) return;
    if (!app.ok(() => toggleHold(R, id))) return;
    app.dismissHint('hold');
    sfx.select();
    syncCubes(false);
    refreshButtons();
  }

  // ---------- Callout ----------

  function showCallout(c: Callout) {
    els.callout.replaceChildren(
      c.icon ? h('div.co-icon', c.icon) : '',
      h('div.co-text', c.text),
      c.sub ? h('div.co-sub', c.sub) : '',
    );
    els.callout.style.setProperty('--c', c.color);
    els.callout.dataset.tier = String(c.tier);
    pulse(els.callout, 'show');
    sfx.callout(c.tier);
    if (c.tier >= 2) shake(c.tier * 3);
  }

  function stamp(text: string, cls: string, target: Element) {
    const s = h('div.stamp-pop', { class: cls }, text);
    target.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }

  // ---------- Throw and reroll animations ----------

  function tumble(
    s: Slot,
    from: { x: number; y: number },
    to: { x: number; y: number },
    size: number,
    dur: number,
    delay = 0,
  ) {
    const pos = s.wrap.animate(
      [
        { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(1.5)` },
        { transform: `translate(${(from.x - to.x) * 0.3}px, ${-to.y + size * 0.3}px) scale(1.15)`, offset: 0.45 },
        { transform: `translate(0px, -12px) scale(1.05)`, offset: 0.75 },
        { transform: 'translate(0,0) scale(1)' },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'backwards' },
    );
    const spins = 2 + Math.floor(Math.random() * 2);
    const z = Math.random() * 16 - 8;
    s.cube.body.animate(
      [
        {
          // Same function order as orient() so the browser interpolates angles, not matrices (which can go NaN).
          transform: `rotateZ(${Math.random() * 90}deg) rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`,
        },
        { transform: s.cube.orient(s.fi, spins, z) },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' },
    );
    s.cube.body.style.transform = s.cube.orient(s.fi, 0, z);
    if (!skip) {
      setTimeout(() => sfx.clack(0.8), delay + dur * 0.45);
      setTimeout(() => sfx.clack(0.4), delay + dur * 0.8);
      setTimeout(() => pulse(backwall, 'hit'), delay + dur * 0.45);
    }
    return new Promise<void>((res) => (pos.onfinish = () => res()));
  }

  async function throwAnim(rep: ThrowReport) {
    clearCubes();
    const addedIds = new Set(rep.added.map((a) => a.id));
    const dice = T.dice!;
    const faces = shownFaces();
    const m = metrics(dice.length);
    sfx.shake();
    sfx.throw();
    const dur = skip ? 150 : app.ms(900);
    const anims: Promise<void>[] = [];
    dice.forEach((d, i) => {
      const s = makeSlot(d, faces[i], m.size, i);
      slots.push(s);
      const p = m.pos(i, d.held);
      place(s, p.x, p.y, m.size);
      els.zone.append(s.wrap, s.plate);
      s.plate.textContent = d.temp ? 'COPY' : String(i + 1);
      s.plate.className = `hold-plate ${d.temp ? 'temp' : ''}`;
      s.wrap.classList.toggle('temp', d.temp);
      if (addedIds.has(d.id)) {
        s.wrap.style.visibility = 'hidden';
        s.plate.style.visibility = 'hidden';
        return;
      }
      anims.push(
        tumble(
          s,
          { x: m.zr.width * (0.2 + (0.6 * i) / Math.max(1, dice.length - 1)), y: m.zr.height + m.size },
          p,
          m.size,
          dur,
          i * 40,
        ),
      );
    });
    await Promise.all(anims);
    // Copies pop out of the die they came from.
    for (const a of rep.added) {
      const s = slots.find((x) => x.id === a.id);
      if (!s) continue;
      await wait(140);
      s.wrap.style.visibility = '';
      s.plate.style.visibility = '';
      pulse(s.wrap, 'split-in');
      const c = center(s.wrap);
      sfx.halo();
      burst(c.x, c.y, 'star', 10, ['#f20884', '#fff'], 4);
      if (a.reason === 'twin') floatText(c.x, c.y - 40, 'Twin!', 'note');
      else {
        const src = els.rails.querySelector(`.charm[data-uid="${a.ref}"]`);
        if (src) pulse(src, 'jiggle');
        floatText(c.x, c.y - 40, 'Split!', 'note');
      }
    }
    flashSpecial();
  }

  /** Mirror and Wild dice call attention to themselves after they land. */
  function flashSpecial() {
    const dice = T.dice ?? [];
    const { mirrored } = mirroredFaces(R, dice);
    dice.forEach((d, i) => {
      const s = slots[i];
      if (!s) return;
      if (mirrored[i]) {
        pulse(s.wrap, 'mirror-flash');
        const c = center(s.wrap);
        floatText(c.x, c.y - 40, 'Mirror', 'note');
      } else if (d.face === WILD) pulse(s.wrap, 'wild-flash');
    });
  }

  async function rerollAnim(ids: string[], tilted: string | null) {
    const dice = T.dice!;
    const faces = shownFaces();
    sfx.shake();
    const dur = skip ? 120 : app.ms(620);
    const anims: Promise<void>[] = [];
    dice.forEach((d, i) => {
      const s = slots.find((x) => x.id === d.id);
      if (!s) return;
      if (!ids.includes(d.id)) {
        setShown(s, d, faces[i], true);
        return;
      }
      const die = dieOf(d);
      const fi = faceIndexFor(die, faces[i], std());
      if ((std() ? [1, 2, 3, 4, 5, 6] : die.faces)[fi] !== faces[i]) s.cube.setFace(fi, faces[i]);
      s.fi = fi;
      s.shown = faces[i];
      const z = Math.random() * 16 - 8;
      const hop = s.wrap.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${Math.random() * 20 - 10}px, -70px) scale(1.12)`, offset: 0.4 },
          { transform: 'translate(0, -8px)', offset: 0.8 },
          { transform: 'translate(0,0)' },
        ],
        { duration: dur, delay: i * 30, easing: 'cubic-bezier(.3,.6,.3,1)' },
      );
      s.cube.body.animate(
        [
          {
            transform: `rotateZ(${Math.random() * 90}deg) rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`,
          },
          { transform: s.cube.orient(fi, 2, z) },
        ],
        { duration: dur, delay: i * 30, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' },
      );
      s.cube.body.style.transform = s.cube.orient(fi, 0, z);
      if (d.id === tilted) {
        const c = center(s.wrap);
        floatText(c.x, c.y - 40, 'Tilt!', 'bad');
      }
      if (!skip) setTimeout(() => sfx.clack(0.7), i * 30 + dur * 0.8);
      anims.push(new Promise((res) => (hop.onfinish = () => res())));
    });
    await Promise.all(anims);
    flashSpecial();
  }

  // ---------- Scoring cascade ----------

  function stepSource(s: ScoreStep): Element | null {
    switch (s.src) {
      case 'hand':
        return els.handBlock;
      case 'die':
      case 'idle':
        return slots.find((x) => x.id === s.ref)?.wrap ?? null;
      case 'charm':
        return els.rails.querySelector(`.charm[data-uid="${s.ref}"]`);
      case 'boss':
        return els.boss;
    }
  }

  async function cascade(rep: ScoreReport) {
    let blip = 0;
    const n = rep.steps.length;
    const base = n > 18 ? 80 : n > 10 ? 120 : 165;
    let lastDie: string | undefined;
    for (const s of rep.steps) {
      const src = stepSource(s);
      const p = src ? center(src) : center(els.calc);
      if (s.src === 'hand') {
        els.chips.textContent = fmt(s.chips ?? 0);
        els.mult.textContent = fmtMult(s.mult ?? 0);
        pulse(els.handBlock, 'pop');
        sfx.blip(blip++);
        await wait(base + 60);
        continue;
      }
      // A charm reacting to a specific die points at that die too.
      if (s.src === 'charm' && s.label && s.label.startsWith('x')) {
        const dsl = slots.find((x) => x.id === s.label);
        if (dsl && dsl.id !== lastDie) pulse(dsl.wrap, 'jiggle');
      }
      if (s.src === 'die') lastDie = s.ref;
      if (src) pulse(src, s.src === 'die' || s.src === 'idle' ? 'die-hit' : 'jiggle');
      if (s.label === 'debuffed') {
        floatText(p.x, p.y - 40, 'Debuffed', 'bad');
        sfx.deny();
      } else if (s.chips) {
        floatText(p.x, p.y - 40, `+${fmt(s.chips)}`, 'chips');
        els.chips.textContent = fmt(s.chipsTotal);
        pulse(els.chips, 'bump');
        sfx.blip(blip++);
      } else if (s.mult) {
        floatText(p.x, p.y - 40, `+${fmtMult(s.mult)} Mult`, 'mult');
        els.mult.textContent = fmtMult(Math.round(s.multTotal * 100) / 100);
        pulse(els.mult, 'bump');
        sfx.mult(blip++);
      } else if (s.xmult) {
        floatText(p.x, p.y - 40, `x${fmtMult(Math.round(s.xmult * 100) / 100)}`, 'xmult', s.xmult >= 2);
        els.mult.textContent = fmtMult(Math.round(s.multTotal * 100) / 100);
        pulse(els.mult, 'bump-big');
        sfx.xmult(blip++);
        if (s.xmult >= 3) shake(4);
      } else if (s.money) {
        floatText(p.x, p.y - 40, `+$${s.money}`, 'money');
        sfx.coin();
      } else if (s.rerolls) {
        floatText(p.x, p.y - 40, `+${s.rerolls} Reroll`, 'note');
        sfx.select();
      } else if (s.src === 'boss') {
        stamp('VOID', 'bad', els.felt);
        sfx.deny();
      }
      await wait(base);
    }
    els.calcResult.textContent = rep.voided ? '0' : fmt(rep.total);
    pulse(els.calcResult, 'show');
    if (rep.total > 0) sfx.chip();
    if (rep.total >= T.target && rep.scoreBefore === 0) {
      showCallout({ text: 'ONE AND DONE', sub: 'One throw beat the whole table', color: '#fcf305', tier: 3 });
      confetti();
    } else if (rep.total >= T.target * 0.5) {
      const c = center(els.calcResult);
      burst(c.x, c.y, 'spark', 26, ['#fcf305', '#ff6403', '#fff'], 7);
      shake(5);
    }
    await wait(240);
  }

  async function afterScore(rep: ScoreReport) {
    for (const nt of rep.notes) {
      const src = els.rails.querySelector(`.charm[data-uid="${nt.ref}"]`);
      if (!src) continue;
      pulse(src, 'jiggle');
      const c = center(src);
      floatText(c.x, c.y - 30, nt.text, 'note');
    }
    for (const lc of rep.levelChanges) {
      const c = center(els.handBlock);
      floatText(c.x, c.y - 30, `${HANDS[lc.hand].name} Lv ${lc.to}`, lc.to > lc.from ? 'note' : 'bad', true);
      if (lc.to > lc.from) sfx.levelUp();
      else sfx.deny();
    }
    if (rep.money !== 0) {
      const m = (document.querySelector('.money-pill') ?? els.score).getBoundingClientRect();
      floatText(
        m.left + m.width / 2,
        m.bottom + 6,
        `${rep.money > 0 ? '+' : ''}$${rep.money}`,
        rep.money > 0 ? 'money' : 'bad',
      );
      app.notify();
    }
    for (const uid of rep.shattered) {
      const ids = rep.dice.filter((d) => d.uid === uid).map((d) => d.id);
      for (const sl of slots.filter((x) => ids.includes(x.id))) {
        const p = center(sl.wrap);
        burst(p.x, p.y, 'shard', 24, ['#02abea', '#ffffff', '#02abea'], 8);
        sl.wrap.style.visibility = 'hidden';
      }
      sfx.shatter();
      app.toast('A Glass die shattered', 'bad');
    }
    if (rep.cloned.length) {
      sfx.fuse();
      app.toast(`Cloned a die into your Box`, 'good');
    }
  }

  async function tableEnd(result: 'won' | 'lost') {
    await wait(300);
    if (result === 'won') {
      showCallout({
        text: 'TABLE CLEARED',
        sub: `${fmt(T.score)} on a ${fmt(T.target)} target`,
        color: '#fcf305',
        tier: 3,
        icon: bitmap(HAPPY_DIE, 72),
      });
      sfx.win();
      confetti();
      await sleep(app.ms(1300));
      if (!destroyed) showPayout();
    } else {
      showCallout({
        text: 'THE HOUSE WINS',
        sub: `${fmt(T.score)} of ${fmt(T.target)}`,
        color: '#dd0806',
        tier: 3,
        icon: bitmap(BUST_DIE, 72),
      });
      sfx.lose();
      el.classList.add('lost');
      await sleep(app.ms(2000));
      app.recordEnd(false);
      app.sync();
    }
  }

  // ---------- Actions ----------

  function begin(): boolean {
    if (app.busy || app.hasModal() || picking) return false;
    app.clearHints();
    app.busy = true;
    skip = false;
    refreshButtons();
    return true;
  }

  function end() {
    app.busy = false;
    rolling = false;
    if (destroyed) return;
    refreshAll();
  }

  async function doThrow() {
    if (canThrow(R) || !begin()) return;
    const rep = app.act(() => throwCup(R));
    if (!rep) return end();
    chosen = null;
    els.calcResult.textContent = '';
    rolling = true;
    refreshScoreboard();
    try {
      await throwAnim(rep);
      rolling = false;
      for (const nt of rep.notes) {
        const src = els.rails.querySelector(`.charm[data-uid="${nt.ref}"]`);
        if (src) pulse(src, 'jiggle');
      }
      const best = handOptions(R)[0];
      if (best && HAND_TIER[best.hand] >= 2) {
        showCallout({
          text: HANDS[best.hand].name.toUpperCase(),
          sub: 'Straight out of the cup',
          color: HANDS[best.hand].color,
          tier: 2,
        });
      }
    } catch (e) {
      console.error(e);
    }
    end();
    maybeHints();
  }

  async function doReroll() {
    if (cantReroll(R) || !begin()) return;
    const before = handOptions(R)[0]?.hand;
    const rep = app.act(() => reroll(R));
    if (!rep) return end();
    chosen = null;
    app.dismissHint('reroll');
    rolling = true;
    refreshScoreboard();
    if (rep.money) {
      const m = (document.querySelector('.money-pill') ?? els.score).getBoundingClientRect();
      floatText(m.left + m.width / 2, m.bottom + 6, `-$1`, 'bad');
    }
    try {
      await rerollAnim(rep.rerolled, rep.tilted);
      rolling = false;
      const best = handOptions(R)[0];
      if (best && best.hand !== before && HAND_TIER[best.hand] >= 2)
        showCallout({
          text: HANDS[best.hand].name.toUpperCase(),
          sub: '',
          color: HANDS[best.hand].color,
          tier: HAND_TIER[best.hand],
        });
    } catch (e) {
      console.error(e);
    }
    end();
  }

  async function doScore() {
    if (cantScore(R) || !begin()) return;
    const hand = current()?.hand;
    const rep = app.act(() => scoreThrow(R, hand));
    if (!rep) return end();
    chosen = null;
    els.calcResult.textContent = '';
    const tier = HAND_TIER[rep.hand];
    try {
      // Non-scoring dice step back so the hand reads clearly.
      slots.forEach((s) => s.wrap.classList.toggle('dim', !rep.dice.find((d) => d.id === s.id)?.scoring));
      showCallout({
        text: HANDS[rep.hand].name.toUpperCase(),
        sub: SUBS[rep.hand] ?? (R.levels[rep.hand] > 1 ? `Level ${R.levels[rep.hand]}` : ''),
        color: HANDS[rep.hand].color,
        tier,
      });
      if (tier >= 3) {
        confetti();
        sfx.pointHit();
      }
      await wait(tier >= 2 ? 500 : 300);
      await cascade(rep);
      await flyNumber(els.calcResult, els.score, fmt(rep.total), 'fly-score');
      sfx.chip();
      await countTo(shownScore, rep.scoreAfter, app.ms(450), setScore);
      pulse(els.score, rep.total >= T.target * 0.5 ? 'bump-big' : 'bump');
      if (rep.total > 0)
        stream(center(els.calcResult), center(els.score), 'chip', Math.min(16, 4 + tier * 4), HANDS[rep.hand].color);
      await afterScore(rep);
      await wait(350);
    } catch (e) {
      console.error(e);
    }
    clearCubes();
    if (destroyed) return;
    if (rep.tableResult) {
      app.busy = false;
      refreshScoreboard();
      refreshTray();
      refreshRails();
      await tableEnd(rep.tableResult);
      return;
    }
    end();
    maybeHints();
  }

  // ---------- Tricks ----------

  function endPick() {
    picking = null;
    els.banner.classList.add('hidden');
    els.felt.classList.remove('picking');
    refreshScoreboard();
  }

  function cancelPick() {
    const p = picking;
    endPick();
    p?.resolve(null);
  }

  app.pickThrown = (prompt, why) =>
    new Promise((resolve) => {
      if (!T.dice || app.busy) return resolve(null);
      picking = { resolve, why };
      els.banner.replaceChildren(
        h('span', prompt),
        h('button.btn.btn-small', { onclick: () => cancelPick() }, 'Cancel'),
      );
      els.banner.classList.remove('hidden');
      els.felt.classList.add('picking');
      refreshScoreboard();
    });

  app.afterTrick = (id, dieId) => {
    chosen = null;
    syncCubes(true);
    const s = slots.find((x) => x.id === dieId);
    const added = id === 'double_down' ? slots[slots.findIndex((x) => x.id === dieId) + 1] : null;
    if (added) {
      pulse(added.wrap, 'split-in');
      const c = center(added.wrap);
      floatText(c.x, c.y - 40, 'Doubled!', 'note');
    } else if (s) {
      const c = center(s.wrap);
      floatText(c.x, c.y - 40, 'Nudged', 'note');
    }
    refreshAll();
  };

  // ---------- Payout ----------

  function showPayout() {
    const p = R.payout;
    if (!p) return;
    const lines = h('div.receipt-lines');
    const total = h('div.receipt-total', h('span', 'Total'), h('b', `$${p.total}`));
    total.style.opacity = '0';
    const btn = h(
      'button.btn.btn-primary.btn-big.btn-wide',
      {
        onclick: () => {
          const final = isFinalWin(R);
          sfx.cashOut();
          const m = center(btn);
          burst(m.x, m.y, 'coin', 24, ['#fcf305'], 8);
          close();
          app.act(() => collectPayout(R));
          if (final) app.recordEnd(true);
          app.sync();
        },
      },
      `Collect $${p.total}`,
    );
    const close = app.modal(
      h(
        'div.receipt',
        h(
          'div.receipt-head',
          h('div.receipt-title', 'CASHIER'),
          h('div.muted', `${TABLE_NAMES[R.tableIndex]}, ante ${R.ante}`),
        ),
        lines,
        total,
        btn,
      ),
      { dismissable: false, cls: 'receipt-wrap' },
    );
    p.lines.forEach((l, i) => {
      setTimeout(
        () => {
          lines.appendChild(h('div.receipt-line', h('span', l.label), h('b', `$${l.amount}`)));
          sfx.coin();
        },
        app.ms(180 + i * 220),
      );
    });
    setTimeout(
      () => {
        total.style.opacity = '1';
        pulse(total, 'bump');
        sfx.score();
        btn.focus();
      },
      app.ms(260 + p.lines.length * 220),
    );
  }

  // ---------- Hints ----------

  function maybeHints() {
    if (T.finished) return;
    if (!T.dice && T.throwsUsed === 0)
      app.hint('throw', els.main, 'Throw every die in your Cup. Space works too.', 'top');
    if (T.dice && T.rerollsLeft > 0)
      app.hint(
        'hold',
        els.zone,
        'Tap dice to hold them (or press 1-9). Reroll throws the rest. Rerolls are shared across the table.',
        'bottom',
      );
    if (T.dice && R.stats.throws >= 1)
      app.hint('hands', els.opts, 'Your best hand is picked. Tap another hand to score that one instead.', 'top');
  }

  // ---------- Keyboard ----------

  const onKey = (e: KeyboardEvent) => {
    if (app.hasModal() || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (picking && e.key === 'Escape') {
      e.stopPropagation();
      cancelPick();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (app.busy) skip = true;
      else void (T.dice ? doScore() : doThrow());
    } else if (e.key === 'r' || e.key === 'R') void doReroll();
    else if (/^[1-9]$/.test(e.key) && T.dice) {
      const d = T.dice[Number(e.key) - 1];
      if (d) onDieClick(d.id);
    }
  };
  addEventListener('keydown', onKey, true);

  const onResize = () => syncCubes(false);
  addEventListener('resize', onResize);

  // ---------- Mount ----------

  refreshAll();
  requestAnimationFrame(() => {
    syncCubes(false);
    if (R.phase === 'payout') showPayout();
    else maybeHints();
    if (T.throwsUsed === 0 && !T.dice && T.bossId) {
      const def = T.bossId === FINAL_BOSS.id ? FINAL_BOSS : BOSSES[T.bossId];
      showCallout({
        text: def.name.toUpperCase(),
        sub: T.bossRules.map((x) => BOSSES[x].desc).join('. '),
        color: def.color,
        tier: 2,
      });
    }
  });

  return {
    el,
    update: refreshAll,
    destroy: () => {
      destroyed = true;
      app.busy = false;
      if (picking) cancelPick();
      removeEventListener('keydown', onKey, true);
      removeEventListener('resize', onResize);
      app.clearHints();
    },
  };
}
