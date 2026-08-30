import React from 'react';
import { InputField } from './InputField';
import { Card, CardSection } from './Card';
import { glossary } from '../common/glossary';
import { effectiveAnnualRate, totalRentOverTerm } from '../common/Formulas';

type Totals = {
  totalPaidGross: number;
  totalPaidNet: number;
  totalInterestGross: number;
  totalInterestNet: number;
  totalInvestedGross: number;
  totalInvestedNet: number;
};

type Props = {
  price: number;
  savings: number;
  cost: number;
  loan: number;
  interest: number;
  percentage: number;
  deduction: number;
  rent: number;
  rentIncrease: number;
  termYears: number;
  termMonths: number;
  annuity: Totals;
  linear: Totals;
  annuityBreakEvenMonth: number | null;
  linearBreakEvenMonth: number | null;
  allCostsEnabled: boolean;
  someCostsEnabled: boolean;
  onToggleAllCosts: () => void;
  onChange: (field: string, value: number) => void;
};

type FieldSpec = {
  title: string;
  /** Second line of the label, for a parenthetical that would otherwise wrap. */
  titleNote?: string;
  valueLabel?: string;
  badge?: 'inline' | 'below';
  prepend?: string;
  append?: string;
  value: number;
  field: string | null;
  disabled?: boolean;
  info?: string;
  toggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    indeterminate?: boolean;
    label?: string;
  };
};

function Field({
  spec,
  onChange,
}: {
  spec: FieldSpec;
  onChange: (field: string, value: number) => void;
}) {
  return (
    <InputField
      disabled={spec.disabled}
      title={spec.title}
      titleNote={spec.titleNote}
      valueLabel={spec.valueLabel}
      badge={spec.badge}
      prepend={spec.prepend}
      append={spec.append}
      value={spec.value}
      info={spec.info}
      toggle={spec.toggle}
      onChange={(value) => spec.field && onChange(spec.field, parseFloat(value))}
    />
  );
}

function BreakEvenField({
  title,
  month,
  termYears,
}: {
  title: string;
  month: number | null;
  termYears: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <span className="flex items-center gap-1.5 text-base text-brand-400">
        {title}
        <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-400 uppercase">
          computed
        </span>
      </span>
      <div className="mt-auto pt-1 rounded-md border border-transparent bg-brand-50 px-3 py-2 text-sm text-brand-500">
        {month === null
          ? `Never within ${termYears} years`
          : `Month ${month} (year ${Math.ceil(month / 12)})`}
      </div>
    </div>
  );
}

function MortgageTypeSection({
  title,
  info,
  totals,
}: {
  title: string;
  info?: string;
  totals: Totals;
}) {
  return (
    <CardSection title={title} info={info}>
      <Field
        spec={{ title: 'Total repaid (gross)', prepend: '€', value: totals.totalPaidGross, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
      <Field
        spec={{ title: 'Total repaid (net)', prepend: '€', value: totals.totalPaidNet, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
      <Field
        spec={{ title: 'Total interest (gross)', prepend: '€', value: totals.totalInterestGross, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
      <Field
        spec={{ title: 'Total interest (net)', prepend: '€', value: totals.totalInterestNet, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
      <Field
        spec={{ title: 'Total invested (gross)', prepend: '€', value: totals.totalInvestedGross, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
      <Field
        spec={{ title: 'Total invested (net)', prepend: '€', value: totals.totalInvestedNet, field: null, disabled: true, badge: 'below' }}
        onChange={() => {}}
      />
    </CardSection>
  );
}

export function Mortgage(props: Props) {
  const { onChange } = props;
  const totalRent = totalRentOverTerm(
    props.rent,
    props.termMonths,
    props.rentIncrease,
  );

  return (
    <div className="space-y-4">
      <Card title="Your details">
        <Field spec={{ title: 'House price', prepend: '€', value: props.price, field: 'price' }} onChange={onChange} />
        <Field spec={{ title: 'Own savings', prepend: '€', value: props.savings, field: 'savings' }} onChange={onChange} />
        <Field spec={{ title: 'Interest', prepend: '%', value: props.interest, field: 'interest' }} onChange={onChange} />
        <Field spec={{ title: 'Effective annual rate', prepend: '%', value: effectiveAnnualRate(props.interest), field: null, disabled: true, info: glossary.effectiveRate }} onChange={onChange} />
        <Field spec={{ title: 'Mortgage term', append: 'years', value: props.termYears, field: 'termYears', info: glossary.term }} onChange={onChange} />
        <Field spec={{ title: 'Interest deduction', prepend: '%', value: props.deduction, field: 'deduction', info: glossary.interestDeduction }} onChange={onChange} />
        <Field spec={{ title: 'Current rent', titleNote: '(used for the rent vs. buy comparison)', prepend: '€', value: props.rent, field: 'rent' }} onChange={onChange} />
      </Card>

      <Card title="Purchase cost" collapsible>
        <Field
          spec={{
            title: 'Enable purchase costs',
            valueLabel: 'Total purchase cost',
            prepend: '€',
            value: props.cost,
            field: null,
            disabled: true,
            toggle: {
              checked: props.allCostsEnabled,
              indeterminate: !props.allCostsEnabled && props.someCostsEnabled,
              label: 'Enable purchase costs',
              onChange: props.onToggleAllCosts,
            },
          }}
          onChange={onChange}
        />
        <Field spec={{ title: 'Remaining = Savings - Cost', prepend: '€', value: props.savings - props.cost, field: null, disabled: true }} onChange={onChange} />
        <Field spec={{ title: 'Required loan', prepend: '€', value: props.loan, field: null, disabled: true }} onChange={onChange} />
        <Field spec={{ title: 'Loan / Price rate (%)', prepend: '%', value: props.percentage * 100, field: null, disabled: true, info: glossary.loanToPrice }} onChange={onChange} />
      </Card>

      <Card
        title={`Rent vs. buy (${props.termYears} years)`}
        collapsible
        defaultOpen={false}
        info={`The first month where what you've spent buying drops to or below what you'd have spent renting.

Buying counts your own savings put in on day one, plus net payments so far. Purchase costs are financed into the loan, so they are already inside those payments.

Equity built and any change in house price are not counted.`}
      >
        <Field spec={{ title: 'Expected annual rent increase', prepend: '%', value: props.rentIncrease, field: 'rentIncrease', info: glossary.rentIncrease }} onChange={onChange} />
        <Field spec={{ title: 'Total invested on rent', prepend: '€', value: totalRent, field: null, disabled: true }} onChange={onChange} />
        <Field spec={{ title: 'Total rent - total cost (gross)', prepend: '€', value: totalRent - props.annuity.totalInvestedGross, field: null, disabled: true }} onChange={onChange} />
        <Field spec={{ title: 'Total rent - total cost (net)', prepend: '€', value: totalRent - props.annuity.totalInvestedNet, field: null, disabled: true }} onChange={onChange} />
        <BreakEvenField title="Break-even (Annuity)" month={props.annuityBreakEvenMonth} termYears={props.termYears} />
        <BreakEvenField title="Break-even (Linear)" month={props.linearBreakEvenMonth} termYears={props.termYears} />
      </Card>

      <Card title="Annuity vs. Linear" collapsible defaultOpen={false} layout="plain">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MortgageTypeSection title="Annuity" info={glossary.annuity} totals={props.annuity} />
          <MortgageTypeSection title="Linear" info={glossary.linear} totals={props.linear} />
        </div>
      </Card>
    </div>
  );
}
