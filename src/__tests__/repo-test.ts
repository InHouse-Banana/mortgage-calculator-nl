import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the work done to take this fork public. These are cheap, and each one
// caught something real when the repo was prepared.

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('repository is safe to publish', () => {
  it('carries no analytics belonging to the upstream owner', () => {
    const html = read('index.html');

    // The fork's own Vercel Analytics is deliberate and lives in App.tsx as a
    // component; what must never come back is the previous owner's GA tag,
    // which would report this deployment's visitors into their property.
    expect(html).not.toContain('UA-165059970-1');
    expect(html).not.toContain('googletagmanager');
    expect(html).not.toMatch(/gtag\(|dataLayer/i);
  });

  it('uses first-party analytics only', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys(pkg.dependencies ?? {});

    expect(deps).toContain('@vercel/analytics');
    // No third-party trackers alongside it.
    expect(deps.join(' ')).not.toMatch(/google|segment|mixpanel|hotjar|amplitude/i);
  });

  it('carries no third-party infrastructure in the scripts', () => {
    const pkg = JSON.parse(read('package.json'));
    const scripts = JSON.stringify(pkg.scripts);

    // S3 bucket, CloudFront distribution and AWS profile of the original owner.
    expect(scripts).not.toMatch(/whathemortgage|E2K5CCBOOMKKA6|aws|s3|cloudfront/i);
    expect(pkg.scripts).not.toHaveProperty('deploy');
    expect(pkg.scripts).not.toHaveProperty('invalidate');
  });

  it('keeps the scripts Vercel needs', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.scripts.build).toBe('tsc && vite build');
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it('pins the Vercel build so importing the repo needs no setup', () => {
    const vercel = JSON.parse(read('vercel.json'));

    expect(vercel.framework).toBe('vite');
    expect(vercel.outputDirectory).toBe('dist');
    expect(vercel.buildCommand).toBe('npm run build');
  });

  it('ignores local notes, env files and vercel state', () => {
    const ignored = read('.gitignore');

    expect(ignored).toMatch(/^\/context$/m);
    expect(ignored).toMatch(/^\.env$/m);
    expect(ignored).toMatch(/^\.env\.\*$/m);
    expect(ignored).toMatch(/^\.vercel$/m);
  });

  it('points the README at the live deployment, not a placeholder', () => {
    const readme = read('README.md');

    expect(readme).toContain('https://mortgage-calculator-nl.vercel.app');
    expect(readme).not.toMatch(/link to follow|TODO/i);
  });

  it('credits the upstream project in the README', () => {
    const readme = read('README.md');

    expect(readme).toContain('## About');
    expect(readme).toContain(
      'https://github.com/santiago-pan/mortgage-calculator',
    );
    expect(readme).toMatch(/fork/i);
    expect(readme).toMatch(/thanks/i);
  });

  it('has no secrets in tracked source', () => {
    ['index.html', 'package.json', 'vercel.json', 'README.md'].forEach((file) => {
      const body = read(file);
      expect(body).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(body).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
      expect(body).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
    });
  });
});

describe('search-engine plumbing', () => {
  const SITE = 'https://mortgage-calculator-nl.vercel.app';

  it('declares a canonical URL', () => {
    const html = read('index.html');

    // Every input change rewrites the query string, so without a canonical
    // Google would index unlimited ?price=... permutations as separate pages.
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`);
  });

  it('serves a robots.txt that actually allows crawling', () => {
    const robots = read('public/robots.txt');

    // `User-agent: *` on its own is not a directive.
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it('serves a sitemap pointing at the live site', () => {
    const sitemap = read('public/sitemap.xml');

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain(`<loc>${SITE}/</loc>`);
  });

  it('never ships a noindex directive', () => {
    expect(read('index.html')).not.toMatch(/name="robots"[^>]*noindex/i);
  });

  it('keeps the sitemap, canonical and README pointing at the same origin', () => {
    [read('index.html'), read('public/sitemap.xml'), read('public/robots.txt'), read('README.md')]
      .forEach((file) => expect(file).toContain(SITE));
  });
});

describe('search console verification', () => {
  it('carries the Google site-verification token', () => {
    const html = read('index.html');

    expect(html).toMatch(/name="google-site-verification"/);
    expect(html).toContain('UsJ_9hhpaeUCjmBOmOeh5t4_oO4l-0luk33wV5XqAw0');
  });
});

describe('link previews', () => {
  const SITE = 'https://mortgage-calculator-nl.vercel.app';
  const html = read('index.html');

  it('declares an og:image, or chat apps show text only', () => {
    expect(html).toContain(`content="${SITE}/og-image.png"`);
    expect(html).toMatch(/property="og:image"/);
    // WhatsApp and friends need absolute URLs — a relative path renders nothing.
    expect(html).not.toMatch(/property="og:image"[^>]*content="\/[^/]/);
  });

  it('declares the image dimensions, so the card renders before the fetch', () => {
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toMatch(/property="og:image:alt"/);
  });

  it('asks for the large card rather than the thumbnail', () => {
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('ships an image that is actually there, and small enough for WhatsApp', () => {
    const file = resolve(process.cwd(), 'public/og-image.png');
    const bytes = readFileSync(file);

    // PNG magic number.
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // WhatsApp silently drops thumbnails much over ~300 kB.
    expect(bytes.length).toBeLessThan(300 * 1024);

    // Dimensions live in the IHDR chunk, bytes 16-24.
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  it('keeps the generator alongside the image it produces', () => {
    expect(read('scripts/generate-og-image.py')).toContain('public/og-image.png');
  });
});
