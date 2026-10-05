// Pixel icons in the System 7 16-color palette, plus hand-drawn bitmaps.

// The Macintosh 16-color system palette.
const PALETTE: [number, number, number][] = [
  [255, 255, 255],
  [252, 243, 5],
  [255, 100, 3],
  [221, 8, 6],
  [242, 8, 132],
  [71, 0, 165],
  [0, 0, 212],
  [2, 171, 234],
  [31, 183, 20],
  [0, 100, 17],
  [86, 44, 5],
  [144, 113, 58],
  [192, 192, 192],
  [128, 128, 128],
  [64, 64, 64],
  [0, 0, 0],
];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function nearest(r: number, g: number, b: number): [number, number, number] {
  let best = PALETTE[0];
  let bd = Infinity;
  for (const p of PALETTE) {
    // Weighted distance keeps skin tones and golds from collapsing to gray.
    const d = 2 * (r - p[0]) ** 2 + 4 * (g - p[1]) ** 2 + 3 * (b - p[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

const cache = new Map<string, string>();
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** Renders an emoji as a dithered, outlined palette icon. Returns a data URL. */
export function iconURL(emoji: string, src = 32): string {
  const key = `${emoji}@${src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = src;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(src * 0.78)}px ${EMOJI_FONT}`;
  g.fillText(emoji, src / 2, src / 2 + src * 0.06);
  const img = g.getImageData(0, 0, src, src);
  const d = img.data;
  const solid = new Uint8Array(src * src);
  for (let y = 0; y < src; y++) {
    for (let x = 0; x < src; x++) {
      const i = (y * src + x) * 4;
      const a = d[i + 3];
      if (a < 120) {
        d[i + 3] = 0;
        continue;
      }
      solid[y * src + x] = 1;
      const k = (BAYER[y % 4][x % 4] / 16 - 0.5) * 56;
      const un = 255 / a;
      const [r, gg, b] = nearest(
        Math.min(255, d[i] * un + k),
        Math.min(255, d[i + 1] * un + k),
        Math.min(255, d[i + 2] * un + k),
      );
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  // 1px black outline around the silhouette, like a hand-drawn Mac icon.
  for (let y = 0; y < src; y++) {
    for (let x = 0; x < src; x++) {
      if (solid[y * src + x]) continue;
      const n =
        (x > 0 && solid[y * src + x - 1]) ||
        (x < src - 1 && solid[y * src + x + 1]) ||
        (y > 0 && solid[(y - 1) * src + x]) ||
        (y < src - 1 && solid[(y + 1) * src + x]);
      if (!n) continue;
      const i = (y * src + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** An <img> pixel icon displayed at `display` CSS px. */
export function px(emoji: string, display = 32, src = display >= 40 ? 32 : display >= 24 ? 24 : 16): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'px-icon';
  img.alt = '';
  img.draggable = false;
  img.width = display;
  img.height = display;
  img.src = iconURL(emoji, src);
  return img;
}

// ---------- Hand-drawn bitmaps ----------
// X = black, o = white, r/y/g/b = palette colors, . = clear.

const BITMAP_COLORS: Record<string, [number, number, number]> = {
  X: [0, 0, 0],
  o: [255, 255, 255],
  r: [221, 8, 6],
  y: [252, 243, 5],
  g: [192, 192, 192],
  d: [128, 128, 128],
};

export function bitmapURL(rows: string[], scale = 1): string {
  const key = rows.join('|') + scale;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = BITMAP_COLORS[ch];
      if (!col) return;
      g.fillStyle = `rgb(${col.join(',')})`;
      g.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function bitmap(rows: string[], display: number, cls = 'px-icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  const w = Math.max(...rows.map((r) => r.length));
  img.width = display;
  img.height = Math.round((display * rows.length) / w);
  img.src = bitmapURL(rows);
  return img;
}

// Lucky, the house mascot: a die with a face.
export const HAPPY_DIE = [
  '..XXXXXXXXXXXXXXXX..',
  '.XooooooooooooooooX.',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XoooooXXooooXXoooooX',
  'XoooooXXooooXXoooooX',
  'XooooooooooooooooooX',
  'XoorrooooooooooorroX',
  'XoorroooooooooooorrX',
  'XoooXooooooooooXoooX',
  'XooooXooooooooXooooX',
  'XoooooXXXXXXXXoooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  '.XooooooooooooooooX.',
  '..XXXXXXXXXXXXXXXX..',
];

export const BUST_DIE = [
  '..XXXXXXXXXXXXXXXX..',
  '.XooooooooooooXoooX.',
  'XoooooooooooooXooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooXoooooX',
  'XooooXoXooXoXooooooX',
  'XoooooXooooXoooooooX',
  'XooooXoXooXoXooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XoooooXXXXXXXXoooooX',
  'XooooXooooooooXooooX',
  'XoooXooooooooooXoooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  'XooooooooooooooooooX',
  '.XooooooooooooooooX.',
  '..XXXXXXXXXXXXXXXX..',
];

export const BOMB = [
  '..........X.y.',
  '.........X.y.y',
  '........X..y..',
  '.....XXXX.....',
  '.....XXXX.....',
  '...XXXXXXXX...',
  '..XXooXXXXXX..',
  '.XXoXXXXXXXXX.',
  '.XXoXXXXXXXXX.',
  'XXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXX',
  '.XXXXXXXXXXXX.',
  '.XXXXXXXXXXXX.',
  '..XXXXXXXXXX..',
  '...XXXXXXXX...',
];

export const STOP_HAND = [
  '....XXXXXXXX....',
  '...XrrrrrrrrX...',
  '..XrrrrrrrrrrX..',
  '.XrrrXrXrXrrrrX.',
  'XrrrrXrXrXrXrrrX',
  'XrrrrXrXrXrXrrrX',
  'XrrXrXoXoXoXrrrX',
  'XrrXoXoXoXoXrrrX',
  'XrrXoooooooXrrrX',
  'XrrrXooooooXrrrX',
  'XrrrrXoooooXrrrX',
  'XrrrrrXXXXXrrrrX',
  '.XrrrrrrrrrrrrX.',
  '..XrrrrrrrrrrX..',
  '...XrrrrrrrrX...',
  '....XXXXXXXX....',
];

export const NOTE = [
  '.....XXXXXX.....',
  '...XXooooooXX...',
  '..XooooXXooooX..',
  '.XoooooXXoooooX.',
  '.XooooooooooooX.',
  'XooooXXXoooooooX',
  'XooooooXXooooooX',
  'XooooooXXooooooX',
  'XooooooXXooooooX',
  'XooooooXXooooooX',
  '.XoooooXXoooooX.',
  '.XooooXXXXooooX.',
  '..XooooooooooX..',
  '...XXooooooXX...',
  '.....XXXXXX.....',
];

const ARROW = [
  'X...........',
  'XX..........',
  'XoX.........',
  'XooX........',
  'XoooX.......',
  'XooooX......',
  'XoooooX.....',
  'XooooooX....',
  'XoooooooX...',
  'XooooooooX..',
  'XoooooXXXXX.',
  'XooXooX.....',
  'XoX.XooX....',
  'XX..XooX....',
  'X....XooX...',
  '.....XooX...',
  '......XX....',
];

const HOURGLASS = [
  'XXXXXXXXXXX',
  'XoooooooooX',
  '.XoooooooX.',
  '.XoXoXoXoX.',
  '..XoXoXoX..',
  '...XoXoX...',
  '....XoX....',
  '.....X.....',
  '....XoX....',
  '...XoooX...',
  '..XoooXoX..',
  '.XoooXoXoX.',
  'XoooXoXoXoX',
  'XoooooooooX',
  'XXXXXXXXXXX',
];

const FINGER = [
  '....XX..........',
  '...XooX.........',
  '...XooX.........',
  '...XooX.........',
  '...XooXXX.......',
  '...XooXooXXX....',
  '.XXXooXooXooXX..',
  'XooXooooooXooX..',
  'XoooXooooooooX..',
  '.XooXooooooooX..',
  '..XooooooooooX..',
  '..XoooooooooX...',
  '...XooooooooX...',
  '....XoooooooX...',
  '....XXXXXXXXX...',
];

/** Installs classic Mac cursors as CSS variables. */
export function installCursors() {
  const cur = (rows: string[], hx: number, hy: number, fallback: string) =>
    `image-set(url("${bitmapURL(rows, 1)}") 1x, url("${bitmapURL(rows, 2)}") 2x) ${hx} ${hy}, ${fallback}`;
  const root = document.documentElement.style;
  root.setProperty('--cur-arrow', cur(ARROW, 0, 0, 'default'));
  root.setProperty('--cur-busy', cur(HOURGLASS, 5, 7, 'wait'));
  root.setProperty('--cur-finger', cur(FINGER, 4, 0, 'pointer'));
}
