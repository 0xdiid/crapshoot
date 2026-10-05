// The soundtrack: four synthesized cues in a casino spy-surf style, sequenced on a 16th-note grid.
// Lobby (menus), Back Room (board and shop), The Felt (tables) and Pit Boss (boss tables).
// The table cues add layers as your score closes in on the target.

import { audioGraph, musicLevel } from './audio';

export type Scene = 'lobby' | 'backroom' | 'table' | 'boss';

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let reverbIn: GainNode | null = null;
let delayIn: GainNode | null = null;

function graph(): boolean {
  if (ctx) return true;
  const g = audioGraph();
  if (!g) return false;
  ctx = g.ctx;
  noiseBuf = g.noise;
  bus = ctx.createGain();
  bus.gain.value = 1.4;
  bus.connect(g.musicBus);

  // A springy plate: decaying stereo noise with a darker tail.
  const len = Math.floor(ctx.sampleRate * 2.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const k = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.6) * (1 + 0.5 * Math.sin(i / 190));
    }
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbTone = ctx.createBiquadFilter();
  verbTone.type = 'lowpass';
  verbTone.frequency.value = 4200;
  reverbIn = ctx.createGain();
  reverbIn.gain.value = 0.55;
  reverbIn.connect(verb).connect(verbTone).connect(bus);

  delayIn = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.34;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const dTone = ctx.createBiquadFilter();
  dTone.type = 'lowpass';
  dTone.frequency.value = 2600;
  delayIn.connect(delay).connect(dTone).connect(fb).connect(delay);
  const dOut = ctx.createGain();
  dOut.gain.value = 0.5;
  const dPan = ctx.createStereoPanner();
  dPan.pan.value = 0.35;
  dTone.connect(dOut).connect(dPan).connect(bus);
  return true;
}

// ---------- Building blocks ----------

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** A voice's output: envelope gain into a panner, with reverb and delay sends. */
function out(t: number, peak: number, attack: number, hold: number, release: number, pan = 0, rev = 0, dly = 0) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  const p = c.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(bus!);
  if (rev) {
    const s = c.createGain();
    s.gain.value = rev;
    p.connect(s).connect(reverbIn!);
  }
  if (dly) {
    const s = c.createGain();
    s.gain.value = dly;
    p.connect(s).connect(delayIn!);
  }
  return { node: g, end: t + attack + hold + release + 0.05 };
}

function osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(end);
  return o;
}

function lfo(rate: number, depth: number, t: number, end: number, targets: AudioParam[], delay = 0) {
  const c = ctx!;
  const o = c.createOscillator();
  o.frequency.value = rate;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.05);
  o.connect(g);
  for (const p of targets) g.connect(p);
  o.start(t);
  o.stop(end);
}

function noiseSrc(t: number, end: number, dest: AudioNode) {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(end);
}

function filter(type: BiquadFilterType, f: number, q = 1) {
  const b = ctx!.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

// ---------- Instruments ----------

/** Upright-ish pluck: triangle body and a filtered square for the thump. */
function bass(t: number, n: number, len: number, v = 0.3) {
  const f = midi(n);
  const o = out(t, v * 0.6, 0.006, len * 0.8, 0.09);
  osc('triangle', f, t, o.end, o.node);
  const lp = filter('lowpass', 900, 2);
  lp.frequency.setValueAtTime(1100, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
  const sq = ctx!.createGain();
  sq.gain.value = 0.35;
  lp.connect(sq).connect(o.node);
  osc('square', f, t, o.end, lp);
}

function kick(t: number, v = 0.8) {
  const o = out(t, v * 0.65, 0.002, 0.02, 0.22);
  const k = osc('sine', 150, t, o.end, o.node);
  k.frequency.exponentialRampToValueAtTime(44, t + 0.13);
}

function snare(t: number, v = 0.3, brush = false) {
  const o = out(t, v, brush ? 0.02 : 0.002, 0.01, brush ? 0.28 : 0.18, 0.05, 0.25);
  const bp = filter('bandpass', brush ? 3500 : 1900, brush ? 0.6 : 0.9);
  bp.connect(o.node);
  noiseSrc(t, o.end, bp);
  if (!brush) {
    const b = out(t, v * 0.6, 0.002, 0.01, 0.07);
    osc('triangle', 190, t, b.end, b.node);
  }
}

function hat(t: number, v = 0.06, open = false) {
  const o = out(t, v * 1.8, 0.002, 0, open ? 0.2 : 0.035, 0.35);
  const hp = filter('highpass', 7500, 1);
  hp.connect(o.node);
  noiseSrc(t, o.end, hp);
}

function ride(t: number, v = 0.05) {
  const o = out(t, v * 1.5, 0.002, 0, 0.32, 0.45, 0.1);
  const hp = filter('bandpass', 6200, 2.5);
  hp.connect(o.node);
  noiseSrc(t, o.end, hp);
  osc('sine', 3150, t, o.end, o.node);
}

function rim(t: number, v = 0.18) {
  const o = out(t, v, 0.001, 0, 0.035, -0.25, 0.15);
  const bp = filter('bandpass', 3000, 5);
  bp.connect(o.node);
  noiseSrc(t, o.end, bp);
  osc('sine', 1650, t, o.end, o.node);
}

function shaker(t: number, v = 0.04) {
  const o = out(t, v * 1.6, 0.012, 0, 0.05, 0.45);
  const bp = filter('bandpass', 5600, 2);
  bp.connect(o.node);
  noiseSrc(t, o.end, bp);
}

function tom(t: number, n: number, v = 0.35) {
  const o = out(t, v, 0.002, 0.02, 0.3, -0.1, 0.25);
  const k = osc('sine', midi(n), t, o.end, o.node);
  k.frequency.exponentialRampToValueAtTime(midi(n) * 0.75, t + 0.3);
}

function crash(t: number, v = 0.09) {
  const o = out(t, v, 0.003, 0.05, 1.3, 0.3, 0.3);
  const hp = filter('highpass', 5200, 0.7);
  hp.connect(o.node);
  noiseSrc(t, o.end, hp);
}

/** Combo organ: three drawbars with a slow vibrato. */
function organ(t: number, notes: number[], len: number, v = 0.04, pan = -0.3, trem = 0) {
  const o = out(t, v * 1.3, 0.015, len, 0.08, pan, 0.2);
  const oscs: OscillatorNode[] = [];
  for (const n of notes) {
    const f = midi(n);
    oscs.push(osc('sine', f, t, o.end, o.node));
    const h2 = ctx!.createGain();
    h2.gain.value = 0.45;
    h2.connect(o.node);
    oscs.push(osc('sine', f * 2, t, o.end, h2));
    const h3 = ctx!.createGain();
    h3.gain.value = 0.22;
    h3.connect(o.node);
    oscs.push(osc('sine', f * 3, t, o.end, h3));
  }
  lfo(
    6.4,
    7,
    t,
    o.end,
    oscs.map((x) => x.detune),
  );
  if (trem) lfo(trem, v * 0.6, t, o.end, [o.node.gain]);
}

/** Electric piano: bell-ish attack that fades. */
function rhodes(t: number, notes: number[], v = 0.05, pan = -0.2) {
  const o = out(t, v * 1.5, 0.004, 0.02, 1.1, pan, 0.25);
  for (const n of notes) {
    const f = midi(n);
    osc('sine', f, t, o.end, o.node);
    const bell = out(t, v * 0.25, 0.002, 0, 0.25, pan);
    osc('sine', f * 4, t, bell.end, bell.node);
  }
}

/** Vibraphone: sine with a motor tremolo and a long tail. */
function vibes(t: number, n: number, len: number, v = 0.08, pan = 0.2) {
  const f = midi(n);
  const o = out(t, v * 1.6, 0.004, Math.min(len, 0.1), 1.1, pan, 0.35, 0.18);
  osc('sine', f, t, o.end, o.node);
  const bell = out(t, v * 0.12, 0.002, 0, 0.18, pan);
  osc('sine', f * 4, t, bell.end, bell.node);
  lfo(5.2, v * 0.35, t, o.end, [o.node.gain]);
}

/** Surf guitar: bright saws through a closing filter, a pitch scoop, late vibrato, drenched in spring. */
function twang(t: number, n: number, len: number, v = 0.1, pan = 0.05) {
  const f = midi(n);
  const o = out(t, v * 1.4, 0.004, len, 0.14, pan, 0.4, 0.3);
  const lp = filter('lowpass', 3200, 3);
  lp.frequency.setValueAtTime(3400, t);
  lp.frequency.exponentialRampToValueAtTime(1100, t + 0.3);
  lp.connect(o.node);
  const a = osc('sawtooth', f, t, o.end, lp);
  const b = osc('square', f, t, o.end, lp, 6);
  for (const x of [a, b]) {
    x.frequency.setValueAtTime(f * 0.97, t);
    x.frequency.exponentialRampToValueAtTime(f, t + 0.035);
  }
  if (len > 0.2) lfo(5.6, 16, t, o.end, [a.detune, b.detune], 0.15);
}

/** Brass stab for the boss: a sweep down from bright to dark. */
function stab(t: number, notes: number[], v = 0.05) {
  const o = out(t, v, 0.008, 0.08, 0.22, 0, 0.2);
  const lp = filter('lowpass', 2600, 2);
  lp.frequency.exponentialRampToValueAtTime(380, t + 0.3);
  lp.connect(o.node);
  for (const n of notes) {
    osc('sawtooth', midi(n), t, o.end, lp, -6);
    osc('sawtooth', midi(n), t, o.end, lp, 6);
  }
}

/** Soft string pad under the lobby. */
function pad(t: number, notes: number[], len: number, v = 0.025) {
  const o = out(t, v, 0.5, len, 0.8, 0, 0.35);
  const lp = filter('lowpass', 900, 0.5);
  lp.connect(o.node);
  for (const n of notes) {
    osc('sawtooth', midi(n), t, o.end, lp, -9);
    osc('sawtooth', midi(n), t, o.end, lp, 9);
  }
}

// ---------- Notation ----------

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function note(s: string): number {
  const m = s.match(/^([A-G])(#|b)?(-?\d)$/)!;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const chord = (s: string) => s.split(' ').map(note);

type Melody = Map<number, [number, number]>;

/** "E5:3 A4:2 -:2" bar by bar ("|" between bars): note name and length in 16ths. */
function mel(src: string): Melody {
  const out: Melody = new Map();
  src
    .split('|')
    .map((b) => b.trim())
    .forEach((bar, bi) => {
      let at = 0;
      for (const tok of bar.split(/\s+/)) {
        const [n, l] = tok.split(':');
        const len = Number(l);
        if (n !== '-') out.set(bi * 16 + at, [note(n), len]);
        at += len;
      }
    });
  return out;
}

// ---------- Songs ----------

interface Step {
  i: number; // 16th in bar
  bar: number;
  t: number;
  s: number; // 16th length in seconds
  lvl: number;
}

interface Song {
  bpm(lvl: number): number;
  swing: number;
  bars: number;
  play(x: Step): void;
}

// The Felt: A minor surf-spy groove. Layers enter as the score climbs.
const FELT_CH = [
  'A3 C4 E4',
  'A3 C4 E4',
  'F3 A3 C4',
  'E3 G#3 B3 D4',
  'A3 C4 E4',
  'A3 C4 E4',
  'D3 F3 A3',
  'E3 G#3 B3 D4',
  'F3 A3 C4',
  'G3 B3 D4',
  'A3 C4 E4',
  'A3 C4 E4',
  'F3 A3 C4',
  'G3 B3 D4',
  'E3 G#3 B3 D4',
  'E3 G#3 B3 D4',
].map(chord);
const FELT_MEL = mel(
  [
    'E5:3 A4:2 C5:2 E5:1 D5:2 C5:2 A4:4',
    '-:2 G4:2 A4:2 C5:2 E5:4 D5:2 C5:2',
    'C5:3 A4:3 F4:2 A4:2 C5:2 F5:4',
    'E5:3 D5:3 B4:2 G#4:4 B4:4',
    'E5:3 A4:2 C5:2 E5:1 D5:2 C5:2 A4:4',
    '-:2 G4:2 A4:2 C5:2 E5:2 G5:2 A5:4',
    'F5:3 E5:3 D5:2 A4:2 D5:2 F5:4',
    'E5:2 F5:2 E5:2 D5:2 B4:2 G#4:2 E4:4',
    'A4:2 C5:2 F5:4 E5:2 C5:2 A4:4',
    'B4:2 D5:2 G5:4 F5:2 D5:2 B4:4',
    'C5:2 E5:2 A5:6 G5:2 E5:4',
    'A5:2 G5:2 E5:2 C5:2 A4:8',
    'A4:2 C5:2 F5:4 E5:2 C5:2 A4:4',
    'B4:2 D5:2 G5:4 A5:2 B5:2 G5:4',
    'B4:4 E5:4 G#5:4 B5:4',
    'D6:1 B5:1 G#5:1 E5:1 D5:1 B4:1 G#4:1 E4:1 -:8',
  ].join('|'),
);

const felt: Song = {
  bpm: (lvl) => 122 + lvl * 12,
  swing: 0,
  bars: 16,
  play({ i, bar, t, s, lvl }) {
    const ch = FELT_CH[bar];
    const root = ch[0];
    if (i % 2 === 0) bass(t, root - 12 + [0, 0, 12, 0, 7, 0, 12, 7][i / 2], s * 1.7, 0.26);
    if (i % 2 === 0 || lvl > 0.85) hat(t, i % 4 === 2 ? 0.05 : i % 2 ? 0.025 : 0.035);
    if (lvl < 0.2) {
      if (i === 4 || i === 12) rim(t, 0.14);
    } else {
      if (i === 4 || i === 12) snare(t, 0.26);
      if (i === 0 || i === 8 || (i === 10 && lvl > 0.5)) kick(t, 0.7);
    }
    if (i === 0) organ(t, ch, s * 15, lvl > 0.3 ? 0.022 : 0.03);
    if (lvl > 0.3 && (i === 6 || i === 14))
      organ(
        t,
        ch.map((n) => n + 12),
        s * 1.2,
        0.03,
        -0.35,
      );
    if (lvl > 0.4 && i % 2 === 1) {
      const up = [...ch, ...ch.map((n) => n + 12)];
      vibes(t, up[((i - 1) / 2) % up.length] + 12, s, 0.028, -0.4);
    }
    const m = FELT_MEL.get(bar * 16 + i);
    if (m) {
      if (lvl >= 0.55) twang(t, m[0], m[1] * s * 0.9, 0.085);
      else vibes(t, m[0], m[1] * s, 0.075);
    }
    if (lvl > 0.6 && bar % 4 === 3 && i >= 12) tom(t, 50 - (i - 12) * 3, 0.3);
    if (lvl > 0.6 && bar % 8 === 0 && i === 0) crash(t);
  },
};

// Pit Boss: E phrygian menace, a crawling ostinato and brass stabs.
const BOSS_CH = [
  'E3 G3 B3',
  'E3 G3 B3',
  'F3 A3 C4',
  'E3 G3 B3',
  'E3 G3 B3',
  'E3 G3 B3',
  'C3 E3 G3',
  'B2 D#3 F#3 A3',
].map(chord);
const BOSS_MEL = mel(
  [
    'E5:6 F5:2 E5:4 B4:4',
    '-:4 G4:2 A4:2 B4:4 C5:2 B4:2',
    'F5:6 E5:2 C5:4 A4:4',
    'B4:8 -:8',
    'E5:6 F5:2 G5:4 F5:2 E5:2',
    'B5:4 A5:2 G5:2 F5:4 E5:4',
    'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4',
    'D#5:4 F#5:4 A5:4 B5:4',
  ].join('|'),
);

const boss: Song = {
  bpm: (lvl) => 134 + lvl * 10,
  swing: 0,
  bars: 8,
  play({ i, bar, t, s, lvl }) {
    const ch = BOSS_CH[bar];
    const root = ch[0] - 12;
    const shape = bar >= 6 ? [0, 0, 7, 0, 12, 0, 7, 5] : [0, 0, 1, 0, 3, 1, 0, -2];
    if (i % 2 === 0) bass(t, root + shape[i / 2], s * 1.6, 0.28);
    if (i % 4 === 0) kick(t, 0.45 + lvl * 0.35);
    if (i % 2 === 0) hat(t, 0.03, i === 14);
    if (lvl > 0.3 && (i === 4 || i === 12)) snare(t, 0.24);
    if (i === 0) organ(t, ch, s * 15, 0.03, -0.3, 7.5);
    if (lvl > 0.45 && (i === 0 || i === 10))
      stab(
        t,
        ch.map((n) => n + 12),
        0.04,
      );
    if (i >= 14 && lvl > 0.4) tom(t, i === 14 ? 45 : 41, 0.28);
    const m = BOSS_MEL.get(bar * 16 + i);
    if (m) twang(t, m[0], m[1] * s * 0.85, 0.05 + lvl * 0.05);
  },
};

// Lobby: D minor spy lounge, the line cliche walking down under a lazy vibraphone.
const LOBBY_CH = [
  'D3 F3 A3',
  'D3 F3 A3 C#4',
  'D3 F3 A3 C4',
  'D3 F3 A3 B3',
  'G3 Bb3 D4 F4',
  'C3 E3 G3 Bb3',
  'F3 A3 C4 E4',
  'A2 C#3 E3 G3',
].map(chord);
const LOBBY_MEL = mel(
  [
    'A4:4 D5:4 F5:6 E5:2',
    'C#5:6 D5:2 E5:4 A4:4',
    'C5:4 D5:4 F5:4 A5:4',
    'B4:8 -:4 A4:4',
    'Bb4:4 D5:4 F5:6 G5:2',
    'E5:4 G5:4 Bb5:4 A5:2 G5:2',
    'A5:8 E5:4 F5:4',
    'E5:4 C#5:4 A4:4 G4:4',
  ].join('|'),
);

const lobby: Song = {
  bpm: () => 84,
  swing: 0.55,
  bars: 8,
  play({ i, bar, t, s }) {
    const ch = LOBBY_CH[bar];
    const next = LOBBY_CH[(bar + 1) % 8][0];
    if (i % 4 === 0) {
      const walk = [ch[0], ch[1], ch[2], next + (bar % 2 ? 1 : -1)][i / 4];
      bass(t, walk - 12, s * 3.4, 0.26);
    }
    if ([0, 4, 6, 8, 12, 14].includes(i)) ride(t, i === 6 || i === 14 ? 0.03 : 0.045);
    if (i === 4 || i === 12) snare(t, 0.08, true);
    if (i === 0) {
      pad(t, ch, s * 14, 0.018);
      kick(t, 0.25);
    }
    if (i === 6 || (i === 14 && bar % 2 === 0))
      rhodes(
        t,
        ch.slice(1).map((n) => n + 12),
        0.035,
      );
    const m = LOBBY_MEL.get(bar * 16 + i);
    if (m) vibes(t, m[0], m[1] * s, 0.1);
  },
};

// Back Room: a bossa in F for shopping.
const BACK_CH = [
  'F3 A3 C4 E4',
  'F3 A3 C4 E4',
  'G3 Bb3 D4 F4',
  'C3 E3 G3 Bb3',
  'A3 C4 E4 G4',
  'D3 F#3 A3 C4',
  'G3 Bb3 D4 F4',
  'C3 E3 G3 Bb3',
].map(chord);
const BACK_MEL = mel(
  [
    'A4:4 C5:2 D5:2 C5:4 A4:4',
    'G4:2 A4:2 C5:6 -:6',
    'Bb4:4 D5:2 F5:2 E5:4 D5:4',
    'C5:6 Bb4:2 G4:8',
    'E5:4 G5:2 A5:2 G5:4 E5:4',
    'F#5:6 E5:2 D5:4 C5:4',
    'Bb4:4 D5:4 F5:4 A5:4',
    'G5:6 E5:2 C5:4 Bb4:4',
  ].join('|'),
);

const backroom: Song = {
  bpm: () => 104,
  swing: 0,
  bars: 8,
  play({ i, bar, t, s }) {
    const ch = BACK_CH[bar];
    const root = ch[0] - 12;
    if (i === 0 || i === 8) bass(t, root, s * 5, 0.28);
    if (i === 6 || i === 14) bass(t, root + 7, s * 2, 0.22);
    if ([0, 3, 6, 10, 12].includes(i)) rim(t, 0.1);
    shaker(t, i % 2 ? 0.02 : 0.035);
    if (i === 0 || i === 6 || i === 8 || i === 14) kick(t, 0.22);
    if ([2, 6, 10, 13].includes(i))
      rhodes(
        t,
        ch.slice(1).map((n) => n + 12),
        0.03,
        0.25,
      );
    const m = BACK_MEL.get(bar * 16 + i);
    if (m) vibes(t, m[0], m[1] * s, 0.09, -0.1);
  },
};

const SONGS: Record<Scene, Song> = { lobby, backroom, table: felt, boss };

// ---------- Sequencer ----------

let timer: number | null = null;
let scene: Scene = 'lobby';
let pending: Scene | null = null;
let song = SONGS.lobby;
let step = 0;
let nextAt = 0;
let intensity = 0;

function tick() {
  const c = ctx!;
  if (nextAt < c.currentTime - 0.1) nextAt = c.currentTime + 0.05; // tab was asleep: skip, don't burst
  while (nextAt < c.currentTime + 0.2) {
    const i = step % 16;
    if (i === 0 && pending) {
      song = SONGS[pending];
      scene = pending;
      pending = null;
      step = 0;
    }
    const s = 60 / song.bpm(intensity) / 4;
    const bar = Math.floor(step / 16) % song.bars;
    const swung = i % 4 === 2 ? song.swing * s * 0.6 : 0;
    if (musicLevel() > 0) song.play({ i: step % 16, bar, t: nextAt + swung, s, lvl: intensity });
    step += 1;
    nextAt += s;
  }
}

export function startMusic(): void {
  if (timer !== null || !graph()) return;
  nextAt = ctx!.currentTime + 0.1;
  step = 0;
  timer = window.setInterval(tick, 50);
}

export function stopMusic(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

/** Switches cue at the next bar line. */
export function setMusicScene(next: Scene): void {
  if (next === scene && !pending) return;
  if (timer === null) {
    scene = next;
    song = SONGS[next];
    return;
  }
  pending = next === scene ? null : next;
}

export function setMusicIntensity(v: number): void {
  intensity = Math.max(0, Math.min(1, v));
}

