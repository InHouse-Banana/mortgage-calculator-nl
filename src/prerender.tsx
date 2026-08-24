// SSR entry, used only by scripts/prerender.mjs at build time.
//
// Rendered with no query string, so the output is the default scenario. React
// then mounts with createRoot, which replaces this markup entirely — we do not
// hydrate, because a link carrying ?price=... would produce different state on
// the client and every hydration would mismatch.
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function render(): string {
  return renderToString(<App />);
}
