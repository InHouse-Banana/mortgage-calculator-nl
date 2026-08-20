// Display helpers. Rounding happens here and nowhere else — the schedule and
// totals in Formulas.tsx keep full precision, because rounding intermediate
// values would accumulate error across hundreds of months.

/** Whole euros; cents are noise on figures this size. */
export function formatEuro(value: number): string {
  return `${Math.round(value).toLocaleString('en-GB')}€`;
}

/** Whole euros with the currency symbol in front, for prose. */
export function formatEuroPrefixed(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}
