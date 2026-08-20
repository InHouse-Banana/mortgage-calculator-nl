import { MonthMortgageData } from './Types';
import { buildXlsx } from './xlsx';

/**
 * Schedule exports: plain values, no formulas.
 *
 * Amounts carry two decimals rather than the whole euros the table displays.
 * The screen rounds so that rows visibly add up; a spreadsheet should get the
 * real figures, so anything computed from the export agrees with the totals
 * instead of drifting by a euro a row.
 */
export const EXPORT_COLUMNS = [
  'Month',
  'Balance',
  'Gross',
  'Capital',
  'Interest',
  'Tax Return',
  'Net',
  'Extra Repayment',
] as const;

const cents = (value: number) => Number(value.toFixed(2));

// Gross and Net are derived from the rounded parts, the same rule the on-screen
// table follows — rounding all six independently would leave rows a cent out,
// since round(a) + round(b) is not always round(a + b). Each figure stays within
// a cent of the true value, and a spreadsheet summing a column lands on the
// totals rather than drifting.
export function scheduleRows(
  monthly: Array<MonthMortgageData>,
): Array<Array<number>> {
  return monthly.map((month) => {
    const capital = cents(month.capitalPaid);
    const interest = cents(month.interest);
    const deduction = cents(month.deduction);
    const gross = cents(capital + interest);

    return [
      month.month,
      cents(month.balance),
      gross,
      capital,
      interest,
      deduction,
      cents(gross - deduction),
      cents(month.overpaid),
    ];
  });
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function scheduleToCsv(monthly: Array<MonthMortgageData>): string {
  const rows = scheduleRows(monthly).map((row) =>
    row.map((value, i) => csvCell(i === 0 ? value : value.toFixed(2))).join(','),
  );
  // CRLF, per RFC 4180 and what Excel expects.
  return [EXPORT_COLUMNS.map(csvCell).join(','), ...rows].join('\r\n') + '\r\n';
}

export function scheduleToXlsx(
  monthly: Array<MonthMortgageData>,
  sheetName: string,
): Uint8Array {
  return buildXlsx(sheetName, EXPORT_COLUMNS, scheduleRows(monthly));
}

/** e.g. mortgage-schedule-annuity-30y-4.62pct */
export function exportBasename(
  kind: string,
  termYears: number,
  interest: number,
): string {
  return `mortgage-schedule-${kind.toLowerCase()}-${termYears}y-${String(interest).replace('.', '-')}pct`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(basename: string, monthly: Array<MonthMortgageData>) {
  // BOM, so Excel reads UTF-8 rather than guessing a legacy code page.
  // \ufeff as an escape, not a literal: a raw BOM in the source is invisible
  // and reads as stray whitespace to tooling.
  downloadBlob(
    `${basename}.csv`,
    new Blob(['\ufeff' + scheduleToCsv(monthly)], {
      type: 'text/csv;charset=utf-8',
    }),
  );
}

export function downloadXlsx(
  basename: string,
  monthly: Array<MonthMortgageData>,
  sheetName: string,
) {
  downloadBlob(
    `${basename}.xlsx`,
    new Blob([scheduleToXlsx(monthly, sheetName) as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
}
