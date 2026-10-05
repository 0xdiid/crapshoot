import {
  cantFuse,
  cantSellDie,
  dieName,
  dieSellValue,
  fuseDice,
  fusePreview,
  FUSE_COST,
  getDie,
  limits,
  MAX_MODS,
  sellDie,
  moveInCup,
  setInCup,
  swapCup,
  type Die,
} from '../engine';
import type { App } from './app';
import { sfx } from './audio';
import { dieTip } from './cards';
import { dieEl } from './die';
import { center, h } from './dom';
import { burst } from './fx';

type Mode = { kind: 'manage' } | { kind: 'fuse'; keep: string };

export function openDiceBox(app: App, onChange?: () => void) {
  const run = app.run!;
  let selected: string | null = null;
  let mode: Mode = { kind: 'manage' };
  let facesFrom: 'keep' | 'feed' = 'keep';
  let feed: string | null = null;
  const body = h('div.dicebox');

  const changed = () => {
    app.save();
    onChange?.();
    render();
  };

  // ---------- Drag and drop between Cup and bench ----------

  type Where = 'cup' | 'bench';
  let dragging = false;

  function targetAt(x: number, y: number): { where: Where; uid?: string } | null {
    const hit = document.elementFromPoint(x, y);
    const slotEl = hit?.closest('.die-slot') as HTMLElement | null;
    if (slotEl?.dataset.where) return { where: slotEl.dataset.where as Where, uid: slotEl.dataset.uid };
    const row = hit?.closest('.db-row') as HTMLElement | null;
    if (row?.dataset.where) return { where: row.dataset.where as Where };
    return null;
  }

  function drop(uid: string, from: Where, to: { where: Where; uid?: string } | null) {
    if (!to || to.uid === uid) return;
    let ok = false;
    if (to.where === from) {
      if (from === 'cup' && to.uid) ok = app.ok(() => moveInCup(run, uid, run.cup.indexOf(to.uid!)));
      else return;
    } else if (to.where === 'cup') {
      if (to.uid) ok = app.ok(() => swapCup(run, to.uid!, uid));
      else if (run.cup.length < limits(run).cupSize) ok = app.ok(() => setInCup(run, uid, true));
      else return app.toast('The Cup is full. Drop onto a Cup die to swap.', 'bad');
    } else {
      if (to.uid) ok = app.ok(() => swapCup(run, uid, to.uid!));
      else ok = app.ok(() => setInCup(run, uid, false));
    }
    if (!ok) return;
    sfx.clack(0.7);
    selected = uid;
    changed();
  }

  function draggable(el: HTMLElement, uid: string, where: Where) {
    el.addEventListener('pointerdown', (e) => {
      if (mode.kind === 'fuse' || e.button !== 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost: HTMLElement | null = null;
      let over: HTMLElement | null = null;
      const mark = (x: number, y: number) => {
        over?.classList.remove('drop-over');
        const t = document.elementFromPoint(x, y);
        over = (t?.closest('.die-slot[data-where]') ?? t?.closest('.db-row[data-where]')) as HTMLElement | null;
        over?.classList.add('drop-over');
      };
      const move = (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          ghost = el.cloneNode(true) as HTMLElement;
          ghost.classList.add('drag-ghost');
          document.body.appendChild(ghost);
          el.classList.add('dragging');
          body.classList.add('drag-active');
          dragging = true;
          sfx.select();
        }
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        mark(ev.clientX, ev.clientY);
      };
      const up = (ev: PointerEvent) => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        over?.classList.remove('drop-over');
        if (!ghost) return;
        ghost.remove();
        el.classList.remove('dragging');
        body.classList.remove('drag-active');
        drop(uid, where, targetAt(ev.clientX, ev.clientY));
        // Swallow the click that follows a drag.
        setTimeout(() => (dragging = false), 0);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    });
  }

  function slot(d: Die | null, where: 'cup' | 'bench') {
    if (!d) return h('div.die-slot.empty', { 'data-where': where }, where === 'cup' ? 'Cup' : '');
    const el = dieEl(d, {
      size: 58,
      cls: [
        selected === d.uid ? 'picked' : '',
        mode.kind === 'fuse' && mode.keep === d.uid ? 'fuse-keep' : '',
        feed === d.uid ? 'fuse-feed' : '',
      ].join(' '),
      onclick: () => {
        if (dragging) return;
        sfx.select();
        if (mode.kind === 'fuse') {
          if (d.uid === mode.keep) return;
          feed = d.uid;
          facesFrom = 'keep';
        } else selected = selected === d.uid ? null : d.uid;
        render();
      },
    });
    draggable(el, d.uid, where);
    return h('div.die-slot', { 'data-where': where, 'data-uid': d.uid }, el);
  }

  function render() {
    const lim = limits(run);
    const cupped = run.cup.map((u) => getDie(run, u)!).filter(Boolean);
    const bench = run.box.filter((d) => !run.cup.includes(d.uid));
    const cupSlots = Array.from({ length: lim.cupSize }, (_, i) => slot(cupped[i] ?? null, 'cup'));
    const benchSlots = Array.from({ length: Math.max(bench.length, lim.boxSize - lim.cupSize) }, (_, i) =>
      slot(bench[i] ?? null, 'bench'),
    );

    let panel: HTMLElement;
    if (mode.kind === 'fuse') {
      const keep = getDie(run, mode.keep)!;
      if (!feed) {
        panel = h(
          'div.db-panel',
          h('h3', `Fuse ${dieName(keep)}`),
          h('p.muted', `Pick the die to fuse into it. The fused die carries both dice's mods (max ${MAX_MODS}).`),
          h('button.btn', { onclick: () => ((mode = { kind: 'manage' }), render()) }, 'Cancel'),
        );
      } else {
        const why = cantFuse(run, mode.keep, feed);
        const prev = fusePreview(run, mode.keep, feed, facesFrom);
        const other = getDie(run, feed)!;
        panel = h(
          'div.db-panel.fuse-panel',
          h('h3', 'Fusion'),
          h(
            'div.fuse-eq',
            dieEl(keep, { size: 44 }),
            h('span.op', '+'),
            dieEl(other, { size: 44 }),
            h('span.op', '='),
            prev ? h('div.fuse-result', dieEl(prev, { size: 64 })) : null,
          ),
          prev ? dieTip(prev) : null,
          h(
            'div.seg',
            h(
              'button',
              { class: facesFrom === 'keep' ? 'on' : '', onclick: () => ((facesFrom = 'keep'), render()) },
              `Faces of ${dieName({ ...keep, mods: [] }).replace(' Die', '')}`,
            ),
            h(
              'button',
              { class: facesFrom === 'feed' ? 'on' : '', onclick: () => ((facesFrom = 'feed'), render()) },
              `Faces of ${dieName({ ...other, mods: [] }).replace(' Die', '')}`,
            ),
          ),
          why ? h('p.err', why) : null,
          h(
            'div.row',
            h('button.btn', { onclick: () => ((mode = { kind: 'manage' }), (feed = null), render()) }, 'Cancel'),
            h(
              'button.btn.btn-primary',
              {
                disabled: !!why,
                onclick: () => {
                  const keepUid = (mode as { keep: string }).keep;
                  const r = app.act(() => fuseDice(run, keepUid, feed!, facesFrom));
                  if (!r) return;
                  sfx.fuse();
                  mode = { kind: 'manage' };
                  selected = r.uid;
                  feed = null;
                  changed();
                  const el = body.querySelector(`.die[data-uid="${r.uid}"]`);
                  if (el) burst(center(el).x, center(el).y, 'star', 24, ['#fcf305', '#4700a5', '#fff'], 7);
                },
              },
              `Fuse for $${FUSE_COST}`,
            ),
          ),
        );
      }
    } else if (selected && getDie(run, selected)) {
      const d = getDie(run, selected)!;
      const inCup = run.cup.includes(d.uid);
      const sellWhy = cantSellDie(run, d.uid);
      panel = h(
        'div.db-panel',
        dieTip(d),
        h(
          'div.row.wrap',
          inCup
            ? h(
                'button.btn',
                {
                  disabled: run.cup.length <= 1,
                  onclick: () => app.ok(() => setInCup(run, d.uid, false)) && (sfx.click(), changed()),
                },
                'Bench it',
              )
            : h(
                'button.btn',
                {
                  onclick: () => {
                    if (run.cup.length < lim.cupSize) app.act(() => setInCup(run, d.uid, true));
                    else {
                      // Cup full: swap with the least-modded die.
                      const out = [...run.cup].sort(
                        (a, b) => getDie(run, a)!.mods.length - getDie(run, b)!.mods.length,
                      )[0];
                      app.act(() => swapCup(run, out, d.uid));
                    }
                    sfx.click();
                    changed();
                  },
                },
                run.cup.length < lim.cupSize ? 'Put in Cup' : 'Swap into Cup',
              ),
          h(
            'button.btn',
            {
              disabled: run.box.length <= 2,
              onclick: () => {
                mode = { kind: 'fuse', keep: d.uid };
                feed = null;
                sfx.select();
                render();
              },
            },
            'Fuse…',
          ),
          h(
            'button.btn.btn-danger',
            {
              disabled: !!sellWhy,
              title: sellWhy ?? '',
              onclick: async () => {
                if (!(await app.confirm(`Sell ${dieName(d)}?`, `You get $${dieSellValue(d)}.`, 'Sell'))) return;
                if (app.act(() => sellDie(run, d.uid)) !== undefined) {
                  sfx.sell();
                  selected = null;
                  changed();
                }
              },
            },
            `Sell $${dieSellValue(d)}`,
          ),
        ),
      );
    } else {
      panel = h(
        'div.db-panel',
        h('p.muted', 'Drag dice between the Cup and the bench (drop on a die to swap). Tap a die to see its faces, fuse it or sell it.'),
      );
    }

    body.replaceChildren(
      h('div.db-head', h('h2', 'Dice Box'), h('span.money', `$${run.money}`)),
      h('div.db-label', 'Cup: you throw all of these every Throw. Drag to rearrange.'),
      h('div.db-row.bowl-row', { 'data-where': 'cup' }, cupSlots),
      ...(benchSlots.length
        ? [h('div.db-label', `Bench: ${bench.length} of ${benchSlots.length}`), h('div.db-row.bench-row', { 'data-where': 'bench' }, benchSlots)]
        : []),
      panel,
    );
  }
  render();
  app.modal(body, { cls: 'wide' });
}

/** Modal to pick a die for a token. */
export function pickDie(
  app: App,
  title: string,
  dice: Die[],
  check: (uid: string) => string | null,
): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const close = app.modal(
      h(
        'div.pick-die',
        h('h2', title),
        h(
          'div.db-row',
          dice.map((d) => {
            const why = check(d.uid);
            const el = dieEl(d, {
              size: 60,
              cls: why ? 'disabled' : '',
              onclick: () => (why ? app.toast(why, 'bad') : finish(d.uid)),
            });
            el.title = why ?? dieName(d);
            return h('div.die-slot', el);
          }),
        ),
        h('button.btn', { onclick: () => finish(null) }, 'Cancel'),
      ),
      { onClose: () => finish(null) },
    );
  });
}
