# Mortgage Calculator NL

## About

Calculate and compare **annuity** and **linear** mortgage repayment plans for buying a
home in the Netherlands, including Dutch purchase costs (transfer tax, NHG, notary,
valuation, agent fees) and a rent-vs-buy break-even.

This project is a fork of
**[santiago-pan/mortgage-calculator](https://github.com/santiago-pan/mortgage-calculator)**
by [Santiago Pan](https://github.com/santiago-pan) — many thanks to him for building
the first version, which this one is based on. The original is still running at
[whathemortgage.com](https://whathemortgage.com/).

## Demo

**[mortgage-calculator-nl.vercel.app](https://mortgage-calculator-nl.vercel.app/)**

## Features

- **Annuity vs. linear** side by side — full month-by-month schedule, totals and a chart.
- **Variable term** — any term from 1 to 40 years, not just the usual 30.
- **Mortgage interest deduction** — gross and net figures throughout.
- **Purchase costs** — every line switchable, including transfer tax, bank guarantee
  and NHG, so you can model a first-time-buyer exemption or an NHG-ineligible purchase.
- **Overpayments** — extra per month, once a year on a month you choose, or a one-off
  lump sum. All three stack, and the calculator warns when you pass the ~10%
  penalty-free annual allowance most Dutch lenders apply.
- **Rent vs. buy** — break-even month against your current rent, with an optional
  expected annual rent increase.
- **Shareable links** — every input is encoded in the URL.
- **Download the schedule** — CSV or Excel, plain values with no formulas.

## Running locally

Requires Node >= 20.19.

```bash
npm install
npm run dev
```

Vite prints the local URL it picked; it varies if the default port is in use.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |

## Deployment

Deployed on **Vercel** at
[mortgage-calculator-nl.vercel.app](https://mortgage-calculator-nl.vercel.app/),
built straight from this repository on every push to `master`. `vercel.json`
pins the framework, build command and output directory, so importing the repo in
Vercel needs no further configuration and no environment variables.

## SEO notes

The production build **prerenders** the app to static HTML (`scripts/prerender.mjs`),
so a crawler's first fetch carries the full page rather than an empty
`<div id="root">`. React replaces that markup on mount rather than hydrating it,
because the app derives its initial state from the query string and any shared link
would otherwise mismatch. Structured data (`WebApplication`) sits in the head, where
it needs no JavaScript at all. Every input change rewrites the query string, so a
canonical URL points all permutations at one page.

## Privacy

Every calculation runs in your browser. Nothing you type — price, savings, income,
rent — is ever sent anywhere; the numbers live only in the page and in the URL you
choose to share.

The site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) for aggregate
page counts. It is cookieless, stores no personal data and does no cross-site
tracking. There are no third-party trackers.

## Tech

Vite · React 18 · TypeScript · Tailwind CSS 4 · Recharts · Vitest + React Testing Library

## Accuracy

The calculation engine (`src/common/Formulas.tsx`) is pure TypeScript with no
dependencies, covered by tests that check it against closed-form formulas and
published mortgage payment figures rather than against its own output.

This calculator is for illustrative purposes only. No guarantee is made as to the
accuracy of the figures. Consult a qualified advisor before making any decision.

## Credits

Original version by [Santiago Pan](https://github.com/santiago-pan) —
[santiago-pan/mortgage-calculator](https://github.com/santiago-pan/mortgage-calculator).
Thanks for the head start. The upstream project does not carry a licence.
