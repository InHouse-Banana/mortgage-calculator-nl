# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A React + TypeScript single-page app that calculates and compares Annuity vs. Linear mortgage repayment plans for home purchases in the Netherlands, including Dutch-specific purchase costs (transfer tax, NHG guarantee, notary, etc.) and a rent-vs-buy comparison. Built with Vite + React 18 + Tailwind CSS 4, tested with Vitest. Deployed on Vercel.

## Commands

Despite the README mentioning `yarn`, this repo has a `package-lock.json` and no `yarn.lock` — use `npm`. Requires Node >= 20.19.

- `npm run dev` — Vite dev server on http://localhost:5173
- `npm run build` — `tsc` typecheck, then production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm test` — single non-interactive run (Vitest + React Testing Library, jsdom)
  - `npm run test:watch` for watch mode
  - Single file: `npx vitest run src/common/__tests__/Formulas-test.tsx`
- `npm run lint` — ESLint
- Deployment is handled by Vercel building from the repo (`vercel.json`); there is no deploy script. The upstream AWS/S3/CloudFront scripts and the previous owner's Google Analytics tag were removed when this fork was set up — do not reintroduce them.

## Architecture

**State lives in one place.** `src/App.tsx` owns a single `AppState` object (price, interest, deduction, savings, rent, and the individual purchase-cost fields) via `useState`, and passes values/`handleChange` down as props. There is no Redux/Context — all derived data (`loan`, `cost`, `percentage`, and the two `MortgageData` results) is recomputed in `App` with `useMemo`/plain calls and threaded down. When adding a new input, it goes into `AppState` in `App.tsx` and is passed through explicitly.

**URL is the persistence layer.** `App.tsx` syncs the fields listed in `URL_SYNCED_FIELDS` (every numeric input: price, interest, deduction, savings, rent, term, all three overpayment channels, and all five editable cost amounts), plus `costsOff` — a comma-separated list of switched-*off* cost lines, omitted entirely when everything is included to the query string on every state change and reads them back on load. There is no router — this is plain `URLSearchParams` + `history.replaceState` (replace, not push, so typing doesn't spam browser history). This is how inputs get shared/bookmarked; there is no other storage, so a link reproduces the whole scenario. The open Mortgage Structure tab (annuity/linear/graph) is synced as `structure`, omitted when it is the default `annuity`; unknown values fall back to the default. Card collapse state is deliberately *not* synced — it is view state, not scenario, and reopens on reload.

**User input is clamped centrally.** `FIELD_BOUNDS` + `clampField` in `App.tsx` bound every numeric input (min/max, and `integer: true` where a fractional value would be nonsense). Add a bound whenever you add an input — an unbounded negative or fractional value propagates straight into the amortization schedule.

**Calculation engine is pure and decoupled from React**: `src/common/Formulas.tsx` implements the financial math from scratch:
- `PMT`/`IPMT`/`PPMT` — standard amortization primitives.
- `calculateAnnuityData` / `calculateLinearData` — each generates a `MonthMortgageData[]` schedule of `termMonths` entries plus aggregate `totals`, applying the Dutch mortgage-interest tax deduction (`taxDeduction` %) to get gross vs. net figures. Both take an optional `termMonths` (5th positional arg, default `DEFAULT_TERM_MONTHS` = 360) and an optional `overpayment` (6th).
- `calgulateLoanFigures` — derives the required loan, total purchase cost, and loan-to-value `percentage` from `AppState`. It owns *all* cost toggles, including the three derived lines (`transferTax`, `bankGuarantee`, `nhg`), so every cost can be zeroed. The master "include all purchase costs" switch on the Purchase summary card is *derived* (`every`/`some` over `TOGGLEABLE_COSTS`), never stored — a second flag would be a competing source of truth and could drift from the per-line switches. It follows native checkbox semantics: indeterminate → click → all on. NHG additionally grosses up the loan, so switching it off shrinks the loan too. Keep the addition order as-is — it preserves bit-identical results for the all-enabled case.
- `calculateBreakEvenMonth` — first month where cumulative buying cost drops below cumulative rent.

**Annuity overpayment uses a level payment.** `levelPayment` is computed once from the original loan and term, and the overpayment path charges `levelPayment - interest` as scheduled capital. Do not re-derive the payment from the remaining balance over the remaining original term on this path: that silently refunds every overpayment as a lower future instalment, so the term never shortens, "months saved" is always 0, and the payment sags month after month on the graph. The plain (no-overpayment) path still re-derives per month — mathematically identical there, and it keeps the exact-float assertions valid. Linear has always shortened the term; both models now agree.

**Overpayments have three independent channels**, all optional and all stacking on the same month: `monthly` (every month), `yearly` (`{ amount, monthOfYear }`, 1 = Jan ... 12 = Dec, default December), and `lumpSum` (`{ month, amount }`, one-off on an absolute schedule month). `extraForMonth` in `Formulas.tsx` is the single place that decides how much extra lands on a given month; both schedule functions then cap that against the outstanding balance, so the loan is never overpaid. Each `MonthMortgageData` carries `overpaid` — the extra actually applied that month, after capping — which is what `findAnnualOverpaymentBreaches` reads to flag years exceeding the ~10% Dutch penalty-free allowance (`PENALTY_FREE_OVERPAYMENT_RATE`). That check warns only; it never caps input, and the penalty itself is not modelled.

Note that paying earlier in the year always costs strictly less interest, but can push the payoff *month* one later, because the final annual boost falls on a different month. Compare `totalInterestGross`, not `payoffMonth`, when reasoning about which schedule is cheaper.

**The mortgage term is variable.** `AppState.termYears` (default 30, clamped to `MIN_TERM_YEARS`..`MAX_TERM_YEARS` and rounded to a whole year) is converted to `termMonths` in `App.tsx` and threaded into both schedule functions. Term constants and `normalizeTermMonths` live in `src/common/constants.ts`; `normalizeTermMonths` guards `Array(n)` against fractional/non-positive lengths, since a `RangeError` there would blank the whole app. Anything that displays a term-dependent horizon (rent-vs-buy totals, "never within N years", "payoff month of N") must read the term rather than assume 360.

These functions are covered by `src/common/__tests__/Formulas-test.tsx` — treat that file as the spec when changing the math. Per-month values are asserted exactly; accumulated `totals` go through the `expectTotals` helper (6-decimal tolerance) because exact float equality on 360 accumulated sums drifts by ~1 ULP across V8 versions. `src/__tests__/App-test.tsx` covers the state/URL/UI wiring end to end.

**Component split** (`src/components/`): `Mortgage.tsx` (main inputs/results + rent comparison), `Costs.tsx` (editable/derived purchase costs, with per-cost include/exclude toggles), `Interest.tsx` (static rate reference table + external links), `Overpayment.tsx` (extra-repayment simulator), `DataTable.tsx` (renders a `MonthMortgageData[]` schedule), `Graph.tsx` (Recharts line chart of both schedules), `InputField.tsx` (shared numeric input using `react-number-format`, committing `onBlur`; it mirrors the committed value in local state and re-syncs during render, so a value the parent clamps back to what it already was can't linger on screen while the maths uses the clamp), `Card.tsx` (optionally `collapsible`, with `layout="plain"` plus `CardSection` for cards that group several blocks — that is how Annuity and Linear share one collapsible card), `Tabs.tsx`, `InfoTooltip.tsx`. `App.tsx` switches between these via two independent tab groups (`InfoTabs`: mortgage/cost/interest/overpayment; `TableTabs`: annuity/linear/graph). Shared constants live in `src/common/constants.ts`, tooltip copy in `src/common/glossary.ts`.

**Money is rounded for display only.** `src/common/format.ts` holds the euro formatters; `InputField` defaults to 0 decimals when `prepend`/`append` is `€` and 2 otherwise, so rates keep their precision. Never round inside `Formulas.tsx` — rounding intermediate values would accumulate error across hundreds of months. `DataTable` rounds Capital/Interest/Tax Return and then *derives* Gross and Net from those rounded parts: rounding all six independently leaves ~40% of linear rows looking a euro out, because `round(a) + round(b) !== round(a + b)`. Each cell stays within €1 of truth and the summary cards still report exact totals.

Styling is Tailwind CSS 4 via `@tailwindcss/vite`, configured in `src/index.css` (including the `brand-*` color scale); no CSS-in-JS or component-scoped styles.
