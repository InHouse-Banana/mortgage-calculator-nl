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

<!-- TODO: replace with the Vercel URL once the first deployment completes -->
_Deploying to Vercel — link to follow._

## Features

- **Annuity vs. linear** side by side — full month-by-month schedule, totals and a chart.
- **Variable term** — any term from 1 to 40 years, not just the usual 30.
- **Mortgage interest deduction** — gross and net figures throughout.
- **Purchase costs** — every line switchable, including transfer tax, bank guarantee
  and NHG, so you can model a first-time-buyer exemption or an NHG-ineligible purchase.
- **Overpayments** — extra per month, once a year on a month you choose, or a one-off
  lump sum. All three stack, and the calculator warns when you pass the ~10%
  penalty-free annual allowance most Dutch lenders apply.
- **Rent vs. buy** — break-even month against your current rent.
- **Shareable links** — every input is encoded in the URL.

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

Deployed on **Vercel**, which builds straight from this repository. `vercel.json`
pins the framework, build command and output directory, so importing the repo in
Vercel needs no further configuration. No environment variables are required —
everything runs in the browser and nothing is sent to a server.

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
