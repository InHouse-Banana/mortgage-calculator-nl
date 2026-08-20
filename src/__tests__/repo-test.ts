import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the work done to take this fork public. These are cheap, and each one
// caught something real when the repo was prepared.

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('repository is safe to publish', () => {
  it('carries no analytics belonging to the upstream owner', () => {
    const html = read('index.html');

    expect(html).not.toContain('UA-165059970-1');
    expect(html).not.toContain('googletagmanager');
    expect(html).not.toMatch(/gtag|dataLayer|analytics/i);
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
