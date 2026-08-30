import React from 'react';
import { InputField } from './InputField';
import { Card } from './Card';
import { AnnualOverpaymentBreach } from '../common/Formulas';
import { PENALTY_FREE_OVERPAYMENT_RATE } from '../common/constants';
import { glossary } from '../common/glossary';
import { formatEuroPrefixed } from '../common/format';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthName(monthOfYear: number) {
  return MONTH_NAMES[Math.min(Math.max(monthOfYear, 1), 12) - 1];
}

type Totals = {
  totalPaidGross: number;
  totalPaidNet: number;
  totalInterestGross: number;
  totalInterestNet: number;
  totalInvestedGross: number;
  totalInvestedNet: number;
  payoffMonth: number;
};

type Props = {
  monthly: number;
  yearly: number;
  yearlyMonth: number;
  lumpSumMonth: number;
  lumpSumAmount: number;
  termMonths: number;
  loan: number;
  onChange: (field: string, value: number) => void;
  annuity: Totals;
  annuityBaseline: Totals;
  annuityBreaches: Array<AnnualOverpaymentBreach>;
  linear: Totals;
  linearBaseline: Totals;
  linearBreaches: Array<AnnualOverpaymentBreach>;
};

// Warns rather than blocks: the allowance varies by lender and by contract, and
// the penalty itself isn't modelled here, so capping the input would invent a
// number. See glossary.penaltyFreeLimit.
function BreachNotice({
  breaches,
  loan,
}: {
  breaches: Array<AnnualOverpaymentBreach>;
  loan: number;
}) {
  if (breaches.length === 0) return null;

  const worst = breaches.reduce((a, b) => (b.rate > a.rate ? b : a));
  const limitPercent = Math.round(PENALTY_FREE_OVERPAYMENT_RATE * 100);

  // Amber plus a heavier left rule: the caution is carried by shape as well as
  // colour, so it survives greyscale and colour-blind viewing.
  return (
    <div
      role="status"
      className="rounded-md border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      <span className="font-semibold">
        Over the {limitPercent}% penalty-free limit
      </span>{' '}
      in {breaches.length === 1 ? 'year' : `${breaches.length} years`}
      {breaches.length === 1 ? ` ${worst.year}` : ''}. Year {worst.year} repays{' '}
      {formatEuroPrefixed(worst.overpaid)} extra — {(worst.rate * 100).toFixed(1)}% of
      the original {formatEuroPrefixed(loan)} loan. Most Dutch lenders allow{' '}
      {limitPercent}% a year without a fee; above that your lender may charge
      one, and it is <em>not</em> included in the figures below.
    </div>
  );
}

function ResultCard({
  title,
  withOverpayment,
  baseline,
  termMonths,
  breaches,
  loan,
}: {
  title: string;
  withOverpayment: Totals;
  baseline: Totals;
  termMonths: number;
  breaches: Array<AnnualOverpaymentBreach>;
  loan: number;
}) {
  const monthsSaved = Math.max(
    baseline.payoffMonth - withOverpayment.payoffMonth,
    0,
  );
  const interestSaved =
    baseline.totalInterestGross - withOverpayment.totalInterestGross;

  return (
    <Card title={title}>
      <BreachNotice breaches={breaches} loan={loan} />
      <InputField
        title="Payoff month"
        titleNote={`(of ${termMonths})`}
        badge="below"
        value={withOverpayment.payoffMonth}
        disabled
        onChange={() => {}}
      />
      <InputField
        title="Months saved"
        badge="below"
        value={monthsSaved}
        disabled
        onChange={() => {}}
      />
      <InputField
        title="Interest saved"
        titleNote="(gross)"
        badge="below"
        prepend="€"
        value={interestSaved}
        disabled
        onChange={() => {}}
      />
      <InputField
        title="Total interest with overpayment"
        titleNote="(gross)"
        badge="below"
        prepend="€"
        value={withOverpayment.totalInterestGross}
        disabled
        onChange={() => {}}
      />
    </Card>
  );
}

export function Overpayment(props: Props) {
  return (
    <div className="space-y-4">
      <Card
        title="Extra repayments"
        info={`Model paying more than the required monthly amount: every month, once a year, or as a one-off lump sum.

All three stack, and each one shortens the term rather than lowering the instalment.`}
      >
        <InputField
          title="Extra amount per month"
          prepend="€"
          value={props.monthly}
          onChange={(value) =>
            props.onChange('overpaymentMonthly', parseFloat(value))
          }
        />
        {/* A monthly amount has no companion month, so the second column stays
            empty and each amount lines up with the month it lands on. */}
        <div className="hidden sm:block" aria-hidden="true" />

        <InputField
          title="Extra amount per year"
          prepend="€"
          info={glossary.yearlyOverpayment}
          value={props.yearly}
          onChange={(value) =>
            props.onChange('overpaymentYearly', parseFloat(value))
          }
        />
        <InputField
          title={`Yearly payment in month (${monthName(props.yearlyMonth)})`}
          value={props.yearlyMonth}
          onChange={(value) =>
            props.onChange('overpaymentYearlyMonth', parseFloat(value))
          }
        />

        <InputField
          title="One-off lump sum amount"
          prepend="€"
          value={props.lumpSumAmount}
          onChange={(value) =>
            props.onChange('overpaymentLumpSumAmount', parseFloat(value))
          }
        />
        <InputField
          title={`Lump sum in month # (1-${props.termMonths})`}
          value={props.lumpSumMonth}
          onChange={(value) =>
            props.onChange('overpaymentLumpSumMonth', parseFloat(value))
          }
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ResultCard
          title="Annuity"
          withOverpayment={props.annuity}
          baseline={props.annuityBaseline}
          termMonths={props.termMonths}
          breaches={props.annuityBreaches}
          loan={props.loan}
        />
        <ResultCard
          title="Linear"
          withOverpayment={props.linear}
          baseline={props.linearBaseline}
          termMonths={props.termMonths}
          breaches={props.linearBreaches}
          loan={props.loan}
        />
      </div>
    </div>
  );
}
