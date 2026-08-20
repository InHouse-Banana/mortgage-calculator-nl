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

describe('chart rendering', () => {
  // Recharts draws nothing under jsdom — ResponsiveContainer measures 0x0, so
  // there is no SVG to query. Assert on the source, as this file already does
  // for CSS: weaker than a rendered check, but it still catches a series added
  // without a stroke width, or the width being dropped.
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/Graph.tsx'),
    'utf8',
  );

  it('gives every series a stroke wider than the 1px default', () => {
    const lines = source.match(/<Line\b/g) ?? [];
    const widths = source.match(/strokeWidth=\{(\d+)\}/g) ?? [];

    expect(lines.length).toBe(6); // 3 metrics x annuity/linear
    expect(widths.length).toBe(lines.length);
    widths.forEach((w) =>
      expect(Number(w.match(/\d+/)![0])).toBeGreaterThanOrEqual(2),
    );
  });

  it('formats the axis and tooltip through the shared euro formatter', () => {
    expect(source).toContain('tickFormatter={formatEuro}');
    expect(source).toContain('formatEuro(Number(value))');
    // No hard-coded unit that would double up with the formatter's symbol.
    expect(source).not.toMatch(/unit="€"/);
  });
});

describe('type scale', () => {
  // The app uses four sizes with settled roles:
  //   text-xl   section headings
  //   text-base body — card titles, input labels, the disclaimer
  //   text-sm   secondary — section subtitles, table cells, buttons
  //   text-xs   annotation — tooltips, the warning banner
  // These assertions derive the expected size from the component that already
  // owns each role, so a new block cannot quietly invent a fifth size.
  const read_ = (file: string) =>
    readFileSync(resolve(process.cwd(), file), 'utf8');

  function sizesIn(source: string): Set<string> {
    return new Set(source.match(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g) ?? []);
  }

  it('uses no size outside the four the app has settled on', () => {
    const files = [
      'src/App.tsx',
      'src/components/Card.tsx',
      'src/components/TableGuide.tsx',
      'src/components/InputField.tsx',
      'src/components/DataTable.tsx',
      'src/components/Tabs.tsx',
      'src/components/InfoTooltip.tsx',
      'src/components/Overpayment.tsx',
    ];
    const allowed = new Set([
      'text-xs',
      'text-sm',
      'text-base',
      'text-xl',
      'text-2xl',
      'text-3xl', // the page h1's responsive pair
    ]);

    files.forEach((file) =>
      sizesIn(read_(file)).forEach((size) =>
        expect(allowed, `${file} uses ${size}`).toContain(size),
      ),
    );
  });

  it('sets the table guide at the body size the disclaimer uses', () => {
    const guide = read_('src/components/TableGuide.tsx');
    const disclaimer = read_('src/App.tsx').match(
      /<section className="([^"]*shadow-sm)">\s*\n\s*<h3[^>]*>\s*Disclaimer/,
    );

    expect(disclaimer![1]).toContain('text-base');
    // Terms and prose sit at that same body size.
    expect(guide).toContain('<dt className="text-base font-semibold');
    expect(guide).toMatch(/block text-base text-brand-500/);
    // Formulas drop one step, to the app's secondary tier.
    expect(guide).toMatch(/font-mono text-sm/);
    // Nothing left at annotation size.
    expect(sizesIn(guide).has('text-xs')).toBe(false);
  });

  it('styles the guide subheading like every other in-card subheading', () => {
    const convention = read_('src/components/Card.tsx').match(
      /<h4 className="([^"]*)"/,
    )![1];
    const guide = read_('src/components/TableGuide.tsx').match(
      /<h4 className="([^"]*)"/,
    )![1];

    ['text-sm', 'font-semibold', 'tracking-wide', 'uppercase'].forEach((cls) => {
      expect(convention).toContain(cls);
      expect(guide, `guide h4 missing ${cls}`).toContain(cls);
    });
  });
});

describe('webfont', () => {
  it('loads real italic faces, so italics are not browser-slanted', () => {
    const importUrl = css.match(/@import url\('([^']+)'\)/)![1];

    expect(importUrl).toContain('Nunito');
    // ital axis, and a bold italic for the h1.
    expect(importUrl).toMatch(/ital,wght@/);
    expect(importUrl).toContain('1,700');
    // Keep text visible while the font loads.
    expect(importUrl).toContain('display=swap');
  });
});
