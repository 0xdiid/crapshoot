// Synthesized sound effects. No audio files. Music lives in music.ts.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let sfxVolume = 0.7;
let musicVolume = 0.35;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVolume;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicVolume;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

export function setVolumes(sfx: number, music: number): void {
  sfxVolume = sfx;
  musicVolume = music;
  if (sfxBus) sfxBus.gain.value = sfx;
  if (musicBus) musicBus.gain.value = music;
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq: number, type: OscillatorType, dur: number, vol: number, when = 0, bus = sfxBus, glideTo?: number) {
  const c = ac();
  if (!c || !bus) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(
  dur: number,
  vol: number,
  filter: BiquadFilterType,
  freq: number,
  q = 1,
  when = 0,
  bus = sfxBus,
  sweepTo?: number,
) {
  const c = ac();
  if (!c || !bus || !noiseBuf) return;
  const t = c.currentTime + when;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  env(g, t, 0.003, vol, dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

// Pentatonic ladder for scoring blips.
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const semi = (base: number, n: number) => base * Math.pow(2, n / 12);

export const sfx = {
  click() {
    tone(900, 'triangle', 0.05, 0.15);
  },
  hover() {
    tone(1500, 'sine', 0.03, 0.04);
  },
  select() {
    tone(660, 'triangle', 0.07, 0.18);
    tone(990, 'triangle', 0.07, 0.1, 0.03);
  },
  deny() {
    tone(180, 'square', 0.12, 0.12, 0, sfxBus, 120);
  },
  shake() {
    for (let i = 0; i < 5; i++) noise(0.03, 0.25, 'bandpass', 3000 + Math.random() * 2000, 4, i * 0.045);
  },
  throw() {
    noise(0.35, 0.2, 'bandpass', 800, 1, 0, sfxBus, 3000);
  },
  clack(strength = 1) {
    noise(0.04, 0.5 * strength, 'bandpass', 2500 + Math.random() * 1500, 3);
    tone(180 + Math.random() * 60, 'sine', 0.06, 0.3 * strength);
  },
  blip(step: number) {
    const f = semi(330, LADDER[Math.min(step, LADDER.length - 1)]);
    tone(f, 'square', 0.08, 0.08);
    tone(f * 2, 'sine', 0.1, 0.06);
  },
  mult(step: number) {
    const f = semi(262, LADDER[Math.min(step, LADDER.length - 1)]);
    tone(f, 'sawtooth', 0.12, 0.07);
    tone(f * 1.5, 'triangle', 0.12, 0.08);
  },
  xmult(step: number) {
    const f = semi(196, LADDER[Math.min(step + 2, LADDER.length - 1)]);
    tone(f, 'sawtooth', 0.22, 0.09, 0, sfxBus, f * 2);
    tone(f * 2, 'square', 0.18, 0.05, 0.04);
  },
  chip() {
    tone(2600, 'sine', 0.06, 0.12);
    tone(3900, 'sine', 0.05, 0.08, 0.01);
  },
  coin() {
    tone(1318, 'square', 0.06, 0.07);
    tone(1760, 'square', 0.2, 0.07, 0.06);
  },
  score(big = false) {
    tone(523, 'triangle', 0.15, 0.2);
    tone(659, 'triangle', 0.15, 0.18, 0.06);
    tone(784, 'triangle', big ? 0.5 : 0.25, 0.2, 0.12);
    if (big) tone(1046, 'triangle', 0.5, 0.18, 0.18);
  },
  callout(tier: number) {
    const base = [220, 262, 330, 392][Math.min(tier, 3)];
    tone(base, 'sawtooth', 0.3, 0.12, 0, sfxBus, base * 1.5);
    noise(0.2, 0.1, 'highpass', 4000);
  },
  pointSet() {
    tone(392, 'triangle', 0.12, 0.2);
    tone(523, 'triangle', 0.2, 0.18, 0.08);
  },
  pointHit() {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(semi(262, n), 'square', 0.25, 0.08, i * 0.05));
    noise(0.6, 0.12, 'highpass', 6000, 1, 0.1);
  },
  sevenOut() {
    tone(220, 'sawtooth', 0.7, 0.25, 0, sfxBus, 55);
    tone(233, 'square', 0.7, 0.12, 0, sfxBus, 58);
    noise(0.8, 0.25, 'lowpass', 1200, 1, 0.05, sfxBus, 200);
  },
  burn() {
    for (let i = 0; i < 8; i++)
      noise(0.05, 0.12, 'bandpass', 1500 + Math.random() * 3000, 2, i * 0.06 + Math.random() * 0.03);
  },
  cashOut() {
    tone(1046, 'square', 0.08, 0.08);
    tone(1318, 'square', 0.08, 0.08, 0.07);
    tone(2093, 'triangle', 0.4, 0.1, 0.14);
    for (let i = 0; i < 6; i++) tone(2600 + i * 90, 'sine', 0.05, 0.05, 0.1 + i * 0.05);
  },
  win() {
    [0, 4, 7, 12].forEach((n, i) => tone(semi(392, n), 'square', 0.3, 0.1, i * 0.09));
    [0, 4, 7, 12].forEach((n, i) => tone(semi(196, n), 'triangle', 0.4, 0.12, i * 0.09));
    noise(1, 0.08, 'highpass', 7000, 1, 0.3);
  },
  lose() {
    [0, -3, -6, -10].forEach((n, i) => tone(semi(330, n), 'triangle', 0.35, 0.15, i * 0.22));
  },
  buy() {
    tone(784, 'square', 0.06, 0.08);
    tone(1175, 'square', 0.15, 0.08, 0.05);
    tone(2600, 'sine', 0.06, 0.12, 0.08);
  },
  sell() {
    tone(1175, 'square', 0.06, 0.08);
    tone(784, 'square', 0.12, 0.08, 0.05);
  },
  flip() {
    noise(0.08, 0.2, 'bandpass', 2000, 2, 0, sfxBus, 5000);
  },
  shatter() {
    for (let i = 0; i < 10; i++) tone(3000 + Math.random() * 4000, 'sine', 0.08, 0.05, i * 0.02);
    noise(0.3, 0.2, 'highpass', 5000);
  },
  halo() {
    [0, 7, 12, 19].forEach((n, i) => tone(semi(880, n), 'sine', 0.4, 0.06, i * 0.05));
  },
  fuse() {
    tone(200, 'sawtooth', 0.5, 0.1, 0, sfxBus, 800);
    noise(0.5, 0.1, 'bandpass', 500, 2, 0, sfxBus, 4000);
    tone(1046, 'triangle', 0.4, 0.12, 0.45);
  },
  levelUp() {
    [0, 4, 7, 11, 14].forEach((n, i) => tone(semi(440, n), 'triangle', 0.2, 0.1, i * 0.06));
  },
  heat() {
    noise(0.25, 0.08, 'bandpass', 600, 1, 0, sfxBus, 1800);
  },
};

/** Shared graph for the music module. */
export function audioGraph(): { ctx: AudioContext; musicBus: GainNode; noise: AudioBuffer } | null {
  const c = ac();
  if (!c || !musicBus || !noiseBuf) return null;
  return { ctx: c, musicBus, noise: noiseBuf };
}

export function musicLevel(): number {
  return musicVolume;
}
