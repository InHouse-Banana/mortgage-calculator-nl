import React from 'react';
import { NumericFormat } from 'react-number-format';
import { MonthMortgageData } from '../common/Types';

type TableProps = {
  data: Array<MonthMortgageData>;
};

function TableNumber(props: { value: number }) {
  return (
    <td className="px-3 py-1.5 text-right tabular-nums">
      <NumericFormat
        value={props.value}
        displayType="text"
        thousandSeparator
        decimalScale={0}
      />
    </td>
  );
}

// Rounding each figure on its own leaves ~40% of rows looking a euro out, since
// round(a) + round(b) need not equal round(a + b). Round the components, then
// derive the totals from those, so every row reconciles as displayed. Each cell
// stays within €1 of its true value, and the summary cards still report the
// exact, unrounded totals.
function displayRow(month: MonthMortgageData) {
  const capitalPaid = Math.round(month.capitalPaid);
  const interest = Math.round(month.interest);
  const deduction = Math.round(month.deduction);
  const grossPaid = capitalPaid + interest;

  return {
    balance: Math.round(month.balance),
    grossPaid,
    capitalPaid,
    interest,
    deduction,
    netPaid: grossPaid - deduction,
  };
}

export function DataTable(props: TableProps) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-brand-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-brand-100)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-brand-400">#</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Balance (€)</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Gross (€)</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Capital (€)</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Interest (€)</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Tax Return (€)</th>
            <th className="px-3 py-2 text-right font-medium text-brand-400">Net (€)</th>
          </tr>
        </thead>
        <tbody>
          {props.data.map((item, i) => {
            const row = displayRow(item);
            return (
              <tr key={i} className="odd:bg-brand-50/50">
                <td className="px-3 py-1.5 text-left text-brand-400">{i + 1}</td>
                <TableNumber value={row.balance} />
                <TableNumber value={row.grossPaid} />
                <TableNumber value={row.capitalPaid} />
                <TableNumber value={row.interest} />
                <TableNumber value={row.deduction} />
                <TableNumber value={row.netPaid} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
