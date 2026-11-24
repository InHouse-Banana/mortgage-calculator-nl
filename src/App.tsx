import React, { useEffect, useState, useMemo } from 'react';
import {
  calculateAnnuityData,
  calculateLinearData,
  calgulateLoanFigures,
  calculateBreakEvenMonth,
  findAnnualOverpaymentBreaches,
} from './common/Formulas';
import { Overpayment as OverpaymentType } from './common/Types';
import {
  DEFAULT_LUMP_SUM_MONTH,
  DEFAULT_RENT_INCREASE,
  DEFAULT_TERM_YEARS,
  MAX_RENT_INCREASE,
  DEFAULT_YEARLY_OVERPAYMENT_MONTH,
  MAX_TERM_YEARS,
  MIN_TERM_YEARS,
  MONTHS_PER_YEAR,
} from './common/constants';
import { Costs } from './components/Costs';
import { DataTable } from './components/DataTable';
import { Graph } from './components/Graph';
import { Interest } from './components/Interest';
import { Mortgage } from './components/Mortgage';
import { Overpayment } from './components/Overpayment';
import { Tabs, TabPanel } from './components/Tabs';
import { TableGuide } from './components/TableGuide';
import { exportBasename } from './common/export';
import { Analytics } from '@vercel/analytics/react';
import './index.css';

export type ToggleableCost =
  | 'notary'
  | 'valuation'
  | 'financialAdvisor'
  | 'realStateAgent'
  | 'structuralSurvey'
  // Derived from the price/loan rather than typed, but still optional: a
  // first-time-buyer exemption, no bank guarantee, or an NHG-ineligible
  // purchase all zero these out.
  | 'transferTax'
  | 'bankGuarantee'
  | 'nhg'
  // Catch-all for anything this list does not name: kitchen, movers, ground
  // rent buy-off, whatever the purchase happens to involve.
  | 'otherCosts';

export const TOGGLEABLE_COSTS: ReadonlyArray<ToggleableCost> = [
  'notary',
  'valuation',
  'financialAdvisor',
  'realStateAgent',
  'structuralSurvey',
  'transferTax',
  'bankGuarantee',
  'nhg',
  'otherCosts',
];

export type AppState = {
  // mortgage
  price: number;
  interest: number;
  deduction: number;
  savings: number;
  rent: number;
  rentIncrease: number;
  termYears: number;

  // costs
  notary: number;
  valuation: number;
  financialAdvisor: number;
  realStateAgent: number;
  structuralSurvey: number;
  otherCosts: number;
  costEnabled: Record<ToggleableCost, boolean>;

  // overpayment simulator
  overpaymentMonthly: number;
  overpaymentYearly: number;
  overpaymentYearlyMonth: number;
  overpaymentLumpSumMonth: number;
  overpaymentLumpSumAmount: number;
};

type InfoTabs = 'mortgage' | 'cost' | 'interest' | 'overpayment';
type TableTabs = 'annuity' | 'linear' | 'graph';

const URL_SYNCED_FIELDS = [
  'price',
  'interest',
  'deduction',
  'savings',
  'rent',
  'rentIncrease',
  'termYears',
  'overpaymentMonthly',
  'overpaymentYearly',
  'overpaymentYearlyMonth',
  'overpaymentLumpSumAmount',
  'overpaymentLumpSumMonth',
  'notary',
  'valuation',
  'financialAdvisor',
  'realStateAgent',
  'structuralSurvey',
  'otherCosts',
] as const;

// Only the switched-*off* costs go in the URL, so the common case (everything
// included) adds nothing to the link.
const COSTS_OFF_PARAM = 'costsOff';

// Which Mortgage Structure tab is open. Like costsOff it is omitted when it is
// the default, so existing links and the common case stay unchanged.
const STRUCTURE_PARAM = 'structure';
const TABLE_TABS: readonly TableTabs[] = ['annuity', 'linear', 'graph'];
const DEFAULT_TABLE_TAB: TableTabs = 'annuity';

function readTableTab(params: URLSearchParams): TableTabs {
  const raw = params.get(STRUCTURE_PARAM);
  return TABLE_TABS.find((value) => value === raw) ?? DEFAULT_TABLE_TAB;
}

function readCostsEnabled(params: URLSearchParams): Record<ToggleableCost, boolean> {
  const off = new Set(
    (params.get(COSTS_OFF_PARAM) ?? '').split(',').filter(Boolean),
  );
  return Object.fromEntries(
    TOGGLEABLE_COSTS.map((cost) => [cost, !off.has(cost)]),
  ) as Record<ToggleableCost, boolean>;
}

function readNumberParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

// Bounds for user-entered fields: without these, a negative price/savings/rate
// silently drives the loan and amortization schedule negative with no error.
const FIELD_BOUNDS: Partial<
  Record<keyof AppState, { min: number; max?: number; integer?: boolean }>
> = {
  price: { min: 0 },
  savings: { min: 0 },
  rent: { min: 0 },
  rentIncrease: { min: 0, max: MAX_RENT_INCREASE },
  interest: { min: 0, max: 20 },
  deduction: { min: 0, max: 100 },
  termYears: { min: MIN_TERM_YEARS, max: MAX_TERM_YEARS, integer: true },
  notary: { min: 0 },
  valuation: { min: 0 },
  financialAdvisor: { min: 0 },
  realStateAgent: { min: 0 },
  structuralSurvey: { min: 0 },
  otherCosts: { min: 0 },
  overpaymentMonthly: { min: 0 },
  overpaymentYearly: { min: 0 },
  overpaymentYearlyMonth: { min: 1, max: MONTHS_PER_YEAR, integer: true },
  // Upper bound is the longest schedule the term allows; the lump-sum month is
  // additionally capped against the *current* term in handleChange.
  overpaymentLumpSumMonth: {
    min: DEFAULT_LUMP_SUM_MONTH,
    max: MAX_TERM_YEARS * MONTHS_PER_YEAR,
    integer: true,
  },
  overpaymentLumpSumAmount: { min: 0 },
};

function clampField(field: string, value: number): number {
  if (Number.isNaN(value)) return 0;
  const bounds = FIELD_BOUNDS[field as keyof AppState];
  if (!bounds) return value;
  let clamped = Math.max(value, bounds.min);
  if (bounds.max !== undefined) clamped = Math.min(clamped, bounds.max);
  if (bounds.integer) clamped = Math.round(clamped);
  return clamped;
}

const App = () => {
  const [state, setState] = useState<AppState>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      price: readNumberParam(params, 'price', 470000),
      interest: readNumberParam(params, 'interest', 3.96),
      deduction: readNumberParam(params, 'deduction', 36.93),
      savings: readNumberParam(params, 'savings', 40000),
      rent: readNumberParam(params, 'rent', 1600),
      rentIncrease: readNumberParam(params, 'rentIncrease', DEFAULT_RENT_INCREASE),
      termYears: clampField(
        'termYears',
        readNumberParam(params, 'termYears', DEFAULT_TERM_YEARS),
      ),
      overpaymentMonthly: readNumberParam(params, 'overpaymentMonthly', 0),
      overpaymentYearly: readNumberParam(params, 'overpaymentYearly', 0),
      overpaymentYearlyMonth: clampField(
        'overpaymentYearlyMonth',
        readNumberParam(
          params,
          'overpaymentYearlyMonth',
          DEFAULT_YEARLY_OVERPAYMENT_MONTH,
        ),
      ),
      overpaymentLumpSumMonth: clampField(
        'overpaymentLumpSumMonth',
        readNumberParam(
          params,
          'overpaymentLumpSumMonth',
          DEFAULT_LUMP_SUM_MONTH,
        ),
      ),
      overpaymentLumpSumAmount: readNumberParam(
        params,
        'overpaymentLumpSumAmount',
        0,
      ),

      notary: readNumberParam(params, 'notary', 1200),
      valuation: readNumberParam(params, 'valuation', 800),
      financialAdvisor: readNumberParam(params, 'financialAdvisor', 2500),
      realStateAgent: readNumberParam(params, 'realStateAgent', 2750 * 1.21),
      structuralSurvey: readNumberParam(params, 'structuralSurvey', 800),
      otherCosts: readNumberParam(params, 'otherCosts', 0),
      costEnabled: readCostsEnabled(params),
    };
  });

  const termMonths = state.termYears * MONTHS_PER_YEAR;

  const [tab, setTab] = useState<TableTabs>(() =>
    readTableTab(new URLSearchParams(window.location.search)),
  );
  const [infoTab, setInfoTab] = useState<InfoTabs>('mortgage');
  const [linkCopied, setLinkCopied] = useState(false);

  const { loan, cost, percentage } = useMemo(
    () => calgulateLoanFigures(state),
    [state],
  );

  // undefined (not a zeroed object) when there's nothing to apply, so the
  // main schedule keeps using the plain, pre-overpayment calculation path.
  const overpayment: OverpaymentType | undefined = useMemo(() => {
    const hasMonthly = state.overpaymentMonthly > 0;
    const hasYearly = state.overpaymentYearly > 0;
    // The month is clamped to at least 1, so an amount on its own is enough —
    // previously a lump sum with no month set was silently ignored.
    const hasLumpSum = state.overpaymentLumpSumAmount > 0;
    if (!hasMonthly && !hasYearly && !hasLumpSum) return undefined;
    return {
      monthly: state.overpaymentMonthly,
      yearly: hasYearly
        ? {
            amount: state.overpaymentYearly,
            monthOfYear: state.overpaymentYearlyMonth,
          }
        : undefined,
      lumpSum: hasLumpSum
        ? {
            month: state.overpaymentLumpSumMonth,
            amount: state.overpaymentLumpSumAmount,
          }
        : undefined,
    };
  }, [
    state.overpaymentMonthly,
    state.overpaymentYearly,
    state.overpaymentYearlyMonth,
    state.overpaymentLumpSumMonth,
    state.overpaymentLumpSumAmount,
  ]);

  const linear = useMemo(
    () =>
      calculateLinearData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
        overpayment,
      ),
    [
      state.interest,
      state.deduction,
      state.savings,
      loan,
      termMonths,
      overpayment,
    ],
  );

  const annuity = useMemo(
    () =>
      calculateAnnuityData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
        overpayment,
      ),
    [
      state.interest,
      state.deduction,
      state.savings,
      loan,
      termMonths,
      overpayment,
    ],
  );

  // Baseline (no overpayment) schedules, kept only to power the "interest
  // saved" comparison on the Overpayment tab.
  const linearBaseline = useMemo(
    () =>
      calculateLinearData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
      ),
    [state.interest, state.deduction, state.savings, loan, termMonths],
  );

  const annuityBaseline = useMemo(
    () =>
      calculateAnnuityData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
      ),
    [state.interest, state.deduction, state.savings, loan, termMonths],
  );

  const annuityBreaches = useMemo(
    () => findAnnualOverpaymentBreaches(annuity.monthly, loan),
    [annuity.monthly, loan],
  );

  const linearBreaches = useMemo(
    () => findAnnualOverpaymentBreaches(linear.monthly, loan),
    [linear.monthly, loan],
  );

  const annuityBreakEvenMonth = useMemo(
    () =>
      calculateBreakEvenMonth(
        annuity.monthly,
        state.savings,
        state.rent,
        state.rentIncrease,
      ),
    [annuity.monthly, state.savings, state.rent, state.rentIncrease],
  );

  const linearBreakEvenMonth = useMemo(
    () =>
      calculateBreakEvenMonth(
        linear.monthly,
        state.savings,
        state.rent,
        state.rentIncrease,
      ),
    [linear.monthly, state.savings, state.rent, state.rentIncrease],
  );

  function handleChange(field: string, value: number) {
    setState((prev) => {
      const next = { ...prev, [field]: clampField(field, value) };
      // A lump sum scheduled past the end of the term would silently never be
      // applied, so keep it inside the schedule as the term shrinks (and when
      // the month itself is edited).
      const maxLumpSumMonth = next.termYears * MONTHS_PER_YEAR;
      next.overpaymentLumpSumMonth = Math.min(
        next.overpaymentLumpSumMonth,
        maxLumpSumMonth,
      );
      return next;
    });
  }

  // Derived, never stored: a separate "all costs" flag would be a second
  // source of truth for the same thing and could drift out of sync with the
  // individual switches on the Purchase Costs tab.
  const allCostsEnabled = TOGGLEABLE_COSTS.every(
    (cost) => state.costEnabled[cost],
  );
  const someCostsEnabled = TOGGLEABLE_COSTS.some(
    (cost) => state.costEnabled[cost],
  );

  // Native checkbox semantics: clicking an indeterminate box checks it, so a
  // mixed state fills in the gaps and only a fully-on state clears everything.
  function handleToggleAllCosts() {
    const enabled = !allCostsEnabled;
    setState((prev) => ({
      ...prev,
      costEnabled: Object.fromEntries(
        TOGGLEABLE_COSTS.map((cost) => [cost, enabled]),
      ) as Record<ToggleableCost, boolean>,
    }));
  }

  function handleToggleCost(field: ToggleableCost, enabled: boolean) {
    setState((prev) => ({
      ...prev,
      costEnabled: { ...prev.costEnabled, [field]: enabled },
    }));
  }

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  useEffect(() => {
    const params = new URLSearchParams();
    URL_SYNCED_FIELDS.forEach((field) =>
      params.set(field, String(state[field])),
    );
    const off = TOGGLEABLE_COSTS.filter((cost) => !state.costEnabled[cost]);
    if (off.length > 0) params.set(COSTS_OFF_PARAM, off.join(','));
    if (tab !== DEFAULT_TABLE_TAB) params.set(STRUCTURE_PARAM, tab);
    const search = '?' + params.toString();
    // replaceState (not pushState) so editing fields doesn't spam browser history.
    if (window.location.search !== search) {
      window.history.replaceState(null, '', search);
    }
  }, [state, tab]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 rounded-lg bg-accent px-6 py-8 text-white shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Mortgage Calculator <i>Revised</i>
          </h1>
          <p className="mt-1 text-white">
            Annuity and Linear mortgage calculator for the Netherlands
          </p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-white/30 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
        >
          {linkCopied ? 'Copied!' : 'Share this scenario'}
        </button>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold text-brand-500">Mortgage</h2>
        <Tabs
          label="Mortgage sections"
          active={infoTab}
          onChange={setInfoTab}
          tabs={[
            { value: 'mortgage', label: 'Mortgage' },
            { value: 'cost', label: 'Purchase Costs' },
            { value: 'overpayment', label: 'Extra Repayments' },
            { value: 'interest', label: 'Interest' },
          ]}
        />
        <div className="mt-4">
          <TabPanel value="mortgage" active={infoTab}>
            <Mortgage
              price={state.price}
              savings={state.savings}
              loan={loan}
              cost={cost}
              interest={state.interest}
              percentage={percentage}
              deduction={state.deduction}
              rent={state.rent}
              rentIncrease={state.rentIncrease}
              termYears={state.termYears}
              termMonths={termMonths}
              allCostsEnabled={allCostsEnabled}
              someCostsEnabled={someCostsEnabled}
              onToggleAllCosts={handleToggleAllCosts}
              annuity={annuity.totals}
              linear={linear.totals}
              annuityBreakEvenMonth={annuityBreakEvenMonth}
              linearBreakEvenMonth={linearBreakEvenMonth}
              onChange={handleChange}
            />
          </TabPanel>
          <TabPanel value="cost" active={infoTab}>
            <Costs
              {...state}
              loan={loan}
              cost={cost}
              allCostsEnabled={allCostsEnabled}
              someCostsEnabled={someCostsEnabled}
              onChange={handleChange}
              onToggle={handleToggleCost}
              onToggleAllCosts={handleToggleAllCosts}
            />
          </TabPanel>
          <TabPanel value="interest" active={infoTab}>
            <Interest
              onSelectRate={(rate) => {
                handleChange('interest', rate);
                setInfoTab('mortgage');
              }}
            />
          </TabPanel>
          <TabPanel value="overpayment" active={infoTab}>
            <Overpayment
              monthly={state.overpaymentMonthly}
              yearly={state.overpaymentYearly}
              yearlyMonth={state.overpaymentYearlyMonth}
              lumpSumMonth={state.overpaymentLumpSumMonth}
              lumpSumAmount={state.overpaymentLumpSumAmount}
              termMonths={termMonths}
              loan={loan}
              annuityBreaches={annuityBreaches}
              linearBreaches={linearBreaches}
              onChange={handleChange}
              annuity={annuity.totals}
              annuityBaseline={annuityBaseline.totals}
              linear={linear.totals}
              linearBaseline={linearBaseline.totals}
            />
          </TabPanel>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold text-brand-500">
          Mortgage Structure
        </h2>
        <Tabs
          label="Mortgage structure views"
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'annuity', label: 'Annuity' },
            { value: 'linear', label: 'Linear' },
            { value: 'graph', label: 'Graph' },
          ]}
        />
        <div className="mt-4">
          <TabPanel value="annuity" active={tab}>
            <DataTable
              data={annuity.monthly}
              name="Annuity"
              basename={exportBasename('annuity', state.termYears, state.interest)}
            />
          </TabPanel>
          <TabPanel value="linear" active={tab}>
            <DataTable
              data={linear.monthly}
              name="Linear"
              basename={exportBasename('linear', state.termYears, state.interest)}
            />
          </TabPanel>
          <TabPanel value="graph" active={tab}>
            <Graph annuity={annuity.monthly} linear={linear.monthly} />
          </TabPanel>
        </div>

        <div className="mt-4">
          <TableGuide />
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-brand-100 bg-white p-4 text-base text-brand-400 shadow-sm">
        <h3 className="mb-1 font-semibold text-brand-500">Disclaimer</h3>
        <p>This calculator is for illustrative purposes only.</p>
        <p>No guarantee is made for the accuracy of the data provided.</p>
        <p>Consult a qualified professional before making any decision.</p>
      </section>

      <footer>
        <a
          href="https://github.com/InHouse-Banana/mortgage-calculator-nl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-brand-200 px-3 py-1.5 text-sm text-brand-500 transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          <img
            src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNOS45OTkgMGMtNS41MjEgMC05Ljk5OSA0LjU5LTkuOTk5IDEwLjI1MyAwIDQuNTMgMi44NjUgOC4zNzMgNi44MzkgOS43MjguNS4wOTQuNjgzLS4yMjIuNjgzLS40OTRsLS4wMTQtMS43NDRjLTIuNzgyLjYxOS0zLjM2OC0xLjM3NS0zLjM2OC0xLjM3NS0uNDU1LTEuMTg1LTEuMTExLTEuNS0xLjExMS0xLjUtLjkwOC0uNjM2LjA2OS0uNjIzLjA2OS0uNjIzIDEuMDA0LjA3MiAxLjUzMiAxLjA1NyAxLjUzMiAxLjA1Ny44OTIgMS41NjcgMi4zNDEgMS4xMTQgMi45MS44NTIuMDkxLS42NjIuMzQ5LTEuMTE0LjYzNS0xLjM3LTIuMjItLjI1OS00LjU1NS0xLjEzOS00LjU1NS01LjA2OCAwLTEuMTE5LjM5LTIuMDM1IDEuMDI5LTIuNzUxLS4xMDMtLjI1OS0uNDQ2LTEuMzAyLjA5OC0yLjcxMyAwIDAgLjgzOS0uMjc2IDIuNzUgMS4wNTEuNzk3LS4yMjggMS42NTMtLjM0MSAyLjUwMy0uMzQ2Ljg1LjAwNCAxLjcwNS4xMTggMi41MDMuMzQ2IDEuOTA5LTEuMzI3IDIuNzQ3LTEuMDUxIDIuNzQ3LTEuMDUxLjU0NiAxLjQxMS4yMDMgMi40NTQuMSAyLjcxMy42NDEuNzE2IDEuMDI4IDEuNjMyIDEuMDI4IDIuNzUxIDAgMy45MzktMi4zMzggNC44MDYtNC41NjYgNS4wNTkuMzU5LjMxNy42NzguOTQyLjY3OCAxLjg5OCAwIDEuMzcxLS4wMTIgMi40NzctLjAxMiAyLjgxMyAwIC4yNzQuMTguNTk0LjY4OC40OTMgMy45NzEtMS4zNTkgNi44MzMtNS4xOTkgNi44MzMtOS43MjggMC01LjY2My00LjQ3OC0xMC4yNTMtMTAuMDAxLTEwLjI1MyIgZmlsbD0iIzAwMCIvPgo8L3N2Zz4K"
            alt=""
            className="h-4 w-4 opacity-60"
          />
          Github
        </a>
      </footer>

      {/* Vercel Web Analytics: cookieless page counts, no personal data and no
          cross-site tracking. Inert outside the Vercel deployment. */}
      <Analytics />
    </div>
  );
};

export default App;
