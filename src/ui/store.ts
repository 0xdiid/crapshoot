import { SAVE_VERSION, type RunState } from '../engine';

export interface Settings {
  sfx: number;
  music: number;
  speed: 1 | 2 | 3;
  shake: boolean;
  reduced: boolean;
  hints: boolean;
}

export interface Meta {
  runs: number;
  wins: number;
  bestAnte: number;
  bestRoll: number;
  stakeUnlocked: number;
  seenHints: string[];
  profileWins: Record<string, number>;
}

const KEY_SAVE = 'crapshoot.save.v1';
const KEY_SETTINGS = 'crapshoot.settings.v1';
const KEY_META = 'crapshoot.meta.v2';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: play on without persistence */
  }
}

const prefersReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const settings: Settings = {
  sfx: 0.7,
  music: 0.35,
  speed: 1,
  shake: true,
  reduced: prefersReduced,
  hints: true,
  ...(read<Partial<Settings>>(KEY_SETTINGS) ?? {}),
};

export const meta: Meta = {
  runs: 0,
  wins: 0,
  bestAnte: 0,
  bestRoll: 0,
  stakeUnlocked: 0,
  seenHints: [],
  profileWins: {},
  ...(read<Partial<Meta>>(KEY_META) ?? {}),
};

export function saveSettings() {
  write(KEY_SETTINGS, settings);
}

export function saveMeta() {
  write(KEY_META, meta);
}

export function saveRun(run: RunState | null) {
  if (!run || run.phase === 'gameover') {
    try {
      localStorage.removeItem(KEY_SAVE);
    } catch {
      /* ignore */
    }
    return;
  }
  write(KEY_SAVE, run);
}

export function loadRun(): RunState | null {
  const r = read<RunState>(KEY_SAVE);
  if (!r || r.version !== SAVE_VERSION) return null;
  return r;
}
