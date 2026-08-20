import React from 'react';
import { Card } from './Card';

type Column = {
  name: string;
  formula: string;
  text: string;
};

const COLUMNS: Array<Column> = [
  {
    name: '#',
    formula: '1 … end of term',
    text: 'The month number, counting from your first payment.',
  },
  {
    name: 'Balance',
    formula: 'previous Balance − previous Capital',
    text: 'What you still owe at the start of that month, before the payment goes out. Row 1 is your full loan; subtract that row’s Capital to get row 2’s Balance.',
  },
  {
    name: 'Gross',
    formula: 'Capital + Interest',
    text: 'What actually leaves your bank account that month.',
  },
  {
    name: 'Capital',
    formula: 'Gross − Interest',
    text: 'The part that reduces your debt (aflossing). On an annuity this grows every month as the interest shrinks; on a linear mortgage it stays the same throughout.',
  },
  {
    name: 'Interest',
    formula: 'Balance × (rate ÷ 12)',
    text: 'The lender’s charge for that month (rente), calculated on the balance at the start of the month.',
  },
  {
    name: 'Tax Return',
    formula: 'Interest × deduction %',
    text: 'The slice of the interest you get back through the Dutch mortgage interest deduction (hypotheekrenteaftrek). Only interest qualifies — never the capital you repay. Shown monthly, though in practice it arrives with your annual tax return unless you apply for a voorlopige teruggaaf.',
  },
  {
    name: 'Net',
    formula: 'Gross − Tax Return',
    text: 'What the month truly costs you once the tax relief is counted.',
  },
];

export function TableGuide() {
  return (
    <Card title="How to read this table" collapsible defaultOpen={false} layout="plain">
      <dl className="space-y-3">
        {COLUMNS.map((column) => (
          <div key={column.name} className="sm:grid sm:grid-cols-[8rem_1fr] sm:gap-4">
            <dt className="text-base font-semibold text-brand-500">{column.name}</dt>
            <dd className="mt-1 sm:mt-0">
              <span className="block font-mono text-sm text-brand-400">
                {column.formula}
              </span>
              <span className="mt-1 block text-base text-brand-500">
                {column.text}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2 border-t border-brand-100 pt-4 text-base text-brand-500">
        <h4 className="mb-2 text-sm font-semibold tracking-wide text-brand-400 uppercase">
          Why a row can look a euro out
        </h4>
        <p>
          Every figure is rounded to the nearest euro for display. Rounding two
          numbers and adding them does not always give the same answer as adding
          them and rounding once — €697.77 and €1,293.43 round to €698 and
          €1,293, which total €1,991, while the true total of €1,991.19 also
          rounds to €1,991. On other rows the two disagree by a euro.
        </p>
        <p>
          The table resolves that in favour of rows that add up: Capital and
          Interest are rounded, and Gross is their sum. The consequence is that
          on an annuity, where the real payment never changes, the Gross column
          can still read €1,991 on one row and €1,992 on the next. Both are
          within a euro of the same underlying payment.
        </p>
        <p>
          Nothing is rounded inside the calculation itself — only on the way to
          the screen. The totals on the cards above are computed at full
          precision from the unrounded schedule, so they will not always equal
          the rounded rows added up by hand.
        </p>
      </div>
    </Card>
  );
}
