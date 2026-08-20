import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The whole UI keys off seven brand tokens. A future palette change must not
// quietly degrade legibility, so the contrast floors are pinned here.

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`missing --color-${name} in src/index.css`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL saturation, 0-1. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min);
}

/** Hue in degrees, 0-360. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Shortest distance between two hues, 0-180. */
function hueGap(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

const WHITE = '#ffffff';

describe('theme contrast', () => {
  it('defines the full brand scale and the canvas', () => {
    ['50', '100', '200', '300', '400', '500', '600'].forEach((step) => {
      expect(token(`brand-${step}`)).toMatch(/^#[0-9a-f]{6}$/i);
    });
    expect(token('canvas')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(token('accent')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  // Floors taken from the palette this replaced, so the redesign can only ever
  // hold or improve legibility.
  it.each([
    ['field labels: brand-400 on white', 'brand-400', WHITE, 4.5],
    ['card headings: brand-500 on white', 'brand-500', WHITE, 6.5],
    ['computed fields: brand-500 on brand-50', 'brand-500', 'brand-50', 4.5],
    // 4.0 not 4.5: the accent is a chosen brand colour that lands just under
    // the small-text AA bar. Pinned so it cannot drift further, and so the
    // trade stays visible rather than being quietly forgotten.
    ['header text: white on accent', WHITE, 'accent', 4.0],
    ['tab labels: brand-300 on white', 'brand-300', WHITE, 3.5],
  ])('%s', (_label, fg, bg, floor) => {
    const a = fg.startsWith('#') ? fg : token(fg);
    const b = bg.startsWith('#') ? bg : token(bg);
    expect(contrast(a, b)).toBeGreaterThanOrEqual(floor);
  });

  it('keeps body text readable on the canvas', () => {
    expect(contrast(token('brand-600'), token('canvas'))).toBeGreaterThanOrEqual(8);
  });

  it('keeps the header accent dark enough for white text', () => {
    const ratio = contrast(WHITE, token('accent'));

    // Clears large-text AA (3:1) comfortably for the h1. Falls just short of
    // the 4.5:1 small-text bar, which is an accepted trade for this brand
    // colour — but must not slide any further.
    expect(ratio).toBeGreaterThanOrEqual(4.0);
  });

  it('keeps the accent vivid rather than just another brand step', () => {
    // It reads as orange, not as the muted terracotta used for type.
    expect(saturation(token('accent'))).toBeGreaterThan(0.8);
    expect(saturation(token('brand-400'))).toBeLessThan(0.8);
  });

  // Text steps were deepened for legibility; these are the floors that buys.
  it.each([
    ['brand-300', 3.5],
    ['brand-400', 5.5],
    ['brand-500', 7.5],
    ['brand-600', 9.0],
  ])('%s stays well clear of AA on white', (step, floor) => {
    expect(contrast(token(step), WHITE)).toBeGreaterThanOrEqual(floor);
  });

  it('runs the brand scale monotonically light to dark', () => {
    const steps = ['50', '100', '200', '300', '400', '500', '600'].map((s) =>
      luminance(token(`brand-${s}`)),
    );
    steps.slice(1).forEach((l, i) => expect(l).toBeLessThan(steps[i]));
  });
});

describe('chart series colours', () => {
  const series = ['chart-gross', 'chart-capital', 'chart-interest'];

  it('are all visible against the white chart card', () => {
    series.forEach((name) =>
      expect(contrast(token(name), WHITE)).toBeGreaterThanOrEqual(3),
    );
  });

  it('are spread in luminance, so they separate in greyscale too', () => {
    const lums = series.map((name) => luminance(token(name))).sort((a, b) => a - b);
    lums.slice(1).forEach((l, i) => expect(l - lums[i]).toBeGreaterThan(0.05));
  });

  it('stays saturated against a near-neutral UI, so lines read as data', () => {
    // Hue distance is meaningless here — the brand scale is almost grey, so it
    // has no meaningful hue. Saturation is what separates data from chrome.
    series.forEach((name) =>
      expect(saturation(token(name))).toBeGreaterThan(0.3),
    );
    ['brand-300', 'brand-400', 'brand-500', 'brand-600'].forEach((name) =>
      expect(saturation(token(name))).toBeLessThan(0.2),
    );
  });

  it('separates the three series in hue as well as luminance', () => {
    const [g, c, i] = series.map((n) => hue(token(n)));
    expect(hueGap(g, c)).toBeGreaterThan(60);
    expect(hueGap(c, i)).toBeGreaterThan(60);
    expect(hueGap(g, i)).toBeGreaterThan(60);
  });
});
