import React from 'react';
import { NumericFormat } from 'react-number-format';
import { MonthMortgageData } from '../common/Types';
import { downloadCsv, downloadXlsx } from '../common/export';

type TableProps = {
  data: Array<MonthMortgageData>;
  /** Shown in the sheet tab and used to name the downloaded file. */
  name: string;
  /** Filename without extension. */
  basename: string;
};

const buttonClass =
  'rounded-md border border-brand-200 px-3 py-1.5 text-sm text-brand-500 transition-colors outline-none hover:border-brand-300 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300';


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
    <>
      <div className="mb-2 flex items-center justify-end gap-2">
        <span className="mr-auto text-sm text-brand-400">
          {props.data.length} months
        </span>
        <button
          type="button"
          className={buttonClass}
          onClick={() => downloadCsv(props.basename, props.data)}
        >
          Download CSV
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => downloadXlsx(props.basename, props.data, props.name)}
        >
          Download Excel
        </button>
      </div>
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
    </>
  );
}
