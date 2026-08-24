import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — plain .mjs build script, no types
import { injectPrerenderedHtml } from '../../scripts/prerender.mjs';

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8');

describe('prerender injection', () => {
  it('replaces the shell content with the rendered markup', () => {
    const html = '<body><div id="root">placeholder</div><script src="x"></script></body>';

    expect(injectPrerenderedHtml(html, '<main>real</main>')).toBe(
      '<body><div id="root"><main>real</main></div><script src="x"></script></body>',
    );
  });

  it('finds the matching close tag through nested divs', () => {
    // The shell fallback contains divs, so a naive indexOf('</div>') would cut
    // in the wrong place and leave stray markup outside the root.
    const html =
      '<div id="root"><div><div>a</div>b</div></div><footer>keep</footer>';

    expect(injectPrerenderedHtml(html, 'X')).toBe(
      '<div id="root">X</div><footer>keep</footer>',
    );
  });

  it('preserves everything around the root', () => {
    const html = read('index.html');
    const out = injectPrerenderedHtml(html, '<p>x</p>');

    expect(out).toContain('<title>');
    expect(out).toContain('google-site-verification');
    expect(out).toContain('application/ld+json');
    expect(out).toContain('<div id="root"><p>x</p></div>');
    // The shell prose is gone, replaced by the markup.
    expect(out).not.toContain('Compare <strong>annuity</strong>');
  });

  it('refuses to guess when the shell is malformed', () => {
    expect(() => injectPrerenderedHtml('<body>no root</body>', 'X')).toThrow(
      /no <div id="root">/,
    );
    expect(() => injectPrerenderedHtml('<div id="root"><div>', 'X')).toThrow(
      /unbalanced/,
    );
  });
});

describe('build wiring', () => {
  const pkg = JSON.parse(read('package.json'));

  it('prerenders as part of the production build', () => {
    // Without this, a deploy silently ships the empty shell again.
    expect(pkg.scripts.build).toContain('vite build');
    expect(pkg.scripts.build).toContain('build:ssr');
    expect(pkg.scripts.build).toContain('node scripts/prerender.mjs');
    expect(pkg.scripts['build:ssr']).toContain('--ssr src/prerender.tsx');
  });

  it('keeps the typecheck ahead of the build', () => {
    expect(pkg.scripts.build.indexOf('tsc')).toBeLessThan(
      pkg.scripts.build.indexOf('vite build'),
    );
  });

  it('has jsdom available at build time, not just in tests', () => {
    // Vercel installs devDependencies during a build, so this is enough — but
    // it must not be pruned to dependencies-only without moving jsdom.
    expect(pkg.devDependencies).toHaveProperty('jsdom');
  });
});
