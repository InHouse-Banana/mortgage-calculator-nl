// Renders the app to static HTML after `vite build`, so a crawler's first
// fetch carries the real page rather than an empty <div id="root">.
//
// Googlebot does execute JavaScript, but on a slower second pass and with a
// render budget it is reluctant to spend on an unknown domain. This removes
// the dependency entirely.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();
const INDEX = resolve(ROOT, 'dist/index.html');

/**
 * Swap the shell's placeholder content for the rendered markup.
 * Exported so the string surgery can be tested without running a build.
 */
export function injectPrerenderedHtml(html, markup) {
  const open = '<div id="root">';
  const start = html.indexOf(open);
  if (start === -1) throw new Error('no <div id="root"> in dist/index.html');

  // Walk to the matching close, since the shell content contains nested divs.
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('<div', i)) depth++;
    else if (html.startsWith('</div>', i)) {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  if (depth !== 0) throw new Error('unbalanced <div id="root">');

  return html.slice(0, start + open.length) + markup + html.slice(i);
}

async function main() {
  // App reads window.location in a useState initializer, so it needs a DOM.
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://mortgage-calculator-nl.vercel.app/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node 24 defines navigator as a getter-only global, so plain assignment
  // throws — redefine the property instead.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });

  const { render } = await import(resolve(ROOT, 'dist-ssr/prerender.js'));

  // react-number-format calls useLayoutEffect, which React warns about during
  // SSR because it cannot be encoded into the output. Harmless here: we do not
  // hydrate, so there is no server/client mismatch to worry about.
  const consoleError = console.error;
  console.error = (...args) =>
    String(args[0]).includes('useLayoutEffect does nothing on the server')
      ? undefined
      : consoleError(...args);

  const markup = render();
  console.error = consoleError;

  const html = readFileSync(INDEX, 'utf8');
  writeFileSync(INDEX, injectPrerenderedHtml(html, markup));
  rmSync(resolve(ROOT, 'dist-ssr'), { recursive: true, force: true });

  console.log(`  prerendered ${markup.length.toLocaleString()} chars into dist/index.html`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
