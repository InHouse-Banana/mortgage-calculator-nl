export const MAX_NHG = 405000;
export const NHG_FEE = 0.006;

export function isNhgEligible(price: number): boolean {
  return price <= MAX_NHG;
}

export function nhgFee(price: number, loan: number): number {
  return isNhgEligible(price) ? NHG_FEE * loan : 0;
}

export const MONTHS_PER_YEAR = 12;
export const DEFAULT_TERM_YEARS = 30;
export const DEFAULT_TERM_MONTHS = DEFAULT_TERM_YEARS * MONTHS_PER_YEAR;

// Dutch mortgages are capped at 30 years for interest-deduction purposes, but
// the calculator allows a wider range so shorter/longer scenarios can be compared.
export const MIN_TERM_YEARS = 1;
export const MAX_TERM_YEARS = 40;

// The schedule length drives `Array(n)`, so a fractional or non-positive term
// would throw a RangeError. Callers pass user input, so normalize here rather
// than trusting every call site.
export function normalizeTermMonths(termMonths: number): number {
  if (!Number.isFinite(termMonths)) return DEFAULT_TERM_MONTHS;
  return Math.max(1, Math.round(termMonths));
}

// Dutch lenders typically allow repaying up to 10% of the *original* loan per
// year without an early-repayment penalty. Used for a warning only — the
// calculator never caps what you enter.
export const PENALTY_FREE_OVERPAYMENT_RATE = 0.1;

// December: the month most people have a bonus available to overpay with.
export const DEFAULT_YEARLY_OVERPAYMENT_MONTH = 12;

// Rent increases are opt-in: the default is 0, so a link shared before this
// existed still shows the figures it showed then.
export const DEFAULT_RENT_INCREASE = 0;
export const MAX_RENT_INCREASE = 20;

// The first month of the schedule. There is no month 0, and defaulting to it
// meant an amount entered without a month did nothing at all.
export const DEFAULT_LUMP_SUM_MONTH = 1;
