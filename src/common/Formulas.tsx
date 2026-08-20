import { MonthMortgageData, MortgageData, Overpayment } from './Types';
import {
  DEFAULT_TERM_MONTHS,
  MONTHS_PER_YEAR,
  PENALTY_FREE_OVERPAYMENT_RATE,
  NHG_FEE,
  isNhgEligible,
  nhgFee,
  normalizeTermMonths,
} from './constants';
import { AppState, ToggleableCost } from '../App';

export function PMT(rate: number, nperiod: number, pv: number) {
  if (rate === 0) return -pv / nperiod;

  const pvif = Math.pow(1 + rate, nperiod);
  const pmt = (rate / (pvif - 1)) * -(pv * pvif);

  return pmt;
}

export function IPMT(pv: number, pmt: number, rate: number, per: number) {
  const tmp = Math.pow(1 + rate, per - 1);
  return 0 - (pv * tmp * rate + pmt * (tmp - 1));
}

export function PPMT(rate: number, per: number, nper: number, pv: number) {
  const pmt = PMT(rate, nper, pv);
  const ipmt = IPMT(pv, pmt, rate, per);
  return pmt - ipmt;
}

// Extra capital repaid on schedule month `i + 1`, before it is capped against
// the outstanding balance. All three channels stack: a yearly amount and a
// lump sum falling on the same month are both applied.
function extraForMonth(overpayment: Overpayment, i: number): number {
  const month = i + 1;
  let extra = Math.max(overpayment.monthly, 0);

  if (
    overpayment.yearly &&
    (i % MONTHS_PER_YEAR) + 1 === overpayment.yearly.monthOfYear
  ) {
    extra += Math.max(overpayment.yearly.amount, 0);
  }

  if (overpayment.lumpSum && overpayment.lumpSum.month === month) {
    extra += Math.max(overpayment.lumpSum.amount, 0);
  }

  return extra;
}

// Mortgages are quoted as a NOMINAL annual rate and the instalment is derived
// from rate/12 — the convention every lender and published payment table uses,
// and what Dutch lenders call the "nominale rente".
//
// Because that monthly rate compounds twelve times, the rate actually earned
// over a year is slightly higher: 6% nominal is 0.5%/month, which compounds to
// 6.1678%. That is not an error, it is the difference between the nominal rate
// and the effective one ("effectieve rente"), and it is why lenders must quote
// both. Converting the other way — (1 + annual)^(1/12) - 1 — would produce an
// effective rate of exactly 6%, but instalments that match no lender's.
export function effectiveAnnualRate(nominalAnnualRate: number): number {
  const monthly = nominalAnnualRate / (12 * 100);
  return (Math.pow(1 + monthly, 12) - 1) * 100;
}

export function calculateAnnuityData(
  loanInterest: number,
  taxDeduction: number,
  savings: number,
  loan: number,
  termMonths: number = DEFAULT_TERM_MONTHS,
  overpayment?: Overpayment,
): MortgageData {
  const rate = loanInterest / (12 * 100);
  const numberOfPeriods = normalizeTermMonths(termMonths);

  // The instalment the loan was contracted at, fixed for its whole life.
  //
  // Only used on the overpayment path. Re-deriving the payment each month from
  // the *remaining* balance and the *original* end date — which is what the
  // plain path below does — silently refunds every overpayment as a lower
  // future instalment, so the term never shortens and "months saved" is always
  // zero. Overpaying shortens the term instead, matching the linear schedule.
  const levelPayment = -PMT(rate, numberOfPeriods, loan);

  let totalPaidGross = 0;
  let totalPaidNet = 0;
  let accPaid = 0;
  let payoffMonth = numberOfPeriods;
  let paidOff = false;

  const monthly = Array(numberOfPeriods)
    .fill(0)
    .map((v, i) => {
      let balance = loan - accPaid;
      balance = Math.max(balance, 0);
      const pmt = PMT(rate, numberOfPeriods - i, balance);
      const ppmt = -PPMT(rate, 1, numberOfPeriods - i, balance);
      const ipmt = -IPMT(balance, pmt, rate, 1);
      let capitalPaid = ppmt;
      let interest = ipmt;
      let overpaid = 0;

      // Gated behind `overpayment` so the default (no-overpayment) arithmetic
      // path stays exactly as it was — Formulas-test.tsx asserts exact floats.
      if (overpayment) {
        if (balance <= 0) {
          capitalPaid = 0;
          interest = 0;
        } else {
          interest = balance * rate;
          // What this month would have repaid anyway, so `overpaid` measures
          // only the extra that actually landed (the final month is capped).
          const scheduled = Math.min(levelPayment - interest, balance);
          capitalPaid = Math.min(
            scheduled + extraForMonth(overpayment, i),
            balance,
          );
          overpaid = Math.max(capitalPaid - scheduled, 0);
        }
      }

      const grossPaid = capitalPaid + interest;
      totalPaidGross += grossPaid;
      const deduction = (interest * taxDeduction) / 100;
      const netPaid = grossPaid - deduction;
      totalPaidNet += netPaid;
      accPaid += capitalPaid;

      if (overpayment && !paidOff && accPaid >= loan) {
        payoffMonth = i + 1;
        paidOff = true;
      }

      return {
        month: i + 1,
        balance,
        grossPaid,
        capitalPaid,
        interest,
        deduction,
        netPaid,
        overpaid,
      };
    });

  return {
    monthly,
    totals: {
      totalPaidGross,
      totalPaidNet,
      totalInterestGross: totalPaidGross - loan,
      totalInterestNet: totalPaidNet - loan,
      totalInvestedGross: totalPaidGross + savings,
      totalInvestedNet: totalPaidNet + savings,
      payoffMonth,
    },
  };
}

export function calculateLinearData(
  loanInterest: number,
  taxDeduction: number,
  savings: number,
  loan: number,
  termMonths: number = DEFAULT_TERM_MONTHS,
  overpayment?: Overpayment,
): MortgageData {
  const numberOfPeriods = normalizeTermMonths(termMonths);
  const capitalPaidBase = loan / numberOfPeriods;
  let totalPaidGross = 0;
  let totalPaidNet = 0;
  let accPaid = 0;
  let payoffMonth = numberOfPeriods;
  let paidOff = false;

  const monthly = Array(numberOfPeriods)
    .fill(0)
    .map((v, i) => {
      // Gated behind `overpayment` so the default (no-overpayment) arithmetic
      // path stays exactly as it was — Formulas-test.tsx asserts exact floats.
      const balance = overpayment
        ? Math.max(loan - accPaid, 0)
        : loan - capitalPaidBase * i;
      let capitalPaid = capitalPaidBase;
      let interest = balance * (loanInterest / (12 * 100));
      let overpaid = 0;

      if (overpayment) {
        if (balance <= 0) {
          capitalPaid = 0;
          interest = 0;
        } else {
          const scheduled = Math.min(capitalPaidBase, balance);
          capitalPaid = Math.min(
            capitalPaidBase + extraForMonth(overpayment, i),
            balance,
          );
          overpaid = Math.max(capitalPaid - scheduled, 0);
        }
      }

      const grossPaid = capitalPaid + interest;
      const deduction = (interest * taxDeduction) / 100;
      const netPaid = grossPaid - deduction;
      totalPaidNet += netPaid;
      totalPaidGross += grossPaid;
      accPaid += capitalPaid;

      if (overpayment && !paidOff && accPaid >= loan) {
        payoffMonth = i + 1;
        paidOff = true;
      }

      return {
        month: i + 1,
        balance,
        grossPaid,
        capitalPaid,
        interest,
        deduction,
        netPaid,
        overpaid,
      };
    });

  return {
    monthly,
    totals: {
      totalPaidGross,
      totalPaidNet,
      totalInterestGross: totalPaidGross - loan,
      totalInterestNet: totalPaidNet - loan,
      totalInvestedGross: totalPaidGross + savings,
      totalInvestedNet: totalPaidNet + savings,
      payoffMonth,
    },
  };
}

export const BANK_GUARANTEE_RATE = 0.001;
export const TRANSFER_TAX_RATE = 0.02;

// Every line is switchable, including the three derived from the price/loan,
// so any of them can be taken out of the purchase entirely. Addition order is
// preserved from before the toggles existed to keep the all-enabled result
// bit-identical.
export function calgulateLoanFigures({
  price,
  notary,
  valuation,
  financialAdvisor,
  realStateAgent,
  structuralSurvey,
  savings,
  costEnabled,
}: AppState): {
  loan: number;
  cost: number;
  percentage: number;
} {
  const on = (field: ToggleableCost) => costEnabled[field];

  const bankGuarantee = on('bankGuarantee') ? BANK_GUARANTEE_RATE * price : 0;
  const transferTax = on('transferTax') ? TRANSFER_TAX_RATE * price : 0;
  const nhgAvailable = on('nhg') && isNhgEligible(price);

  let cost =
    bankGuarantee +
    transferTax +
    (on('notary') ? notary : 0) +
    (on('valuation') ? valuation : 0) +
    (on('financialAdvisor') ? financialAdvisor : 0) +
    (on('realStateAgent') ? realStateAgent : 0) +
    (on('structuralSurvey') ? structuralSurvey : 0);

  const loan = Math.max(
    (price - savings + cost) / (nhgAvailable ? 1 - NHG_FEE : 1),
    0,
  );

  cost = cost + (nhgAvailable ? nhgFee(price, loan) : 0);

  const percentage = price > 0 ? loan / price : 0;

  return { loan, cost, percentage };
}

// First month where the cumulative cost of buying drops at or below the
// cumulative rent paid so far, or null if that never happens in the schedule.
//
// `upfrontOutlay` is the buyer's own money paid on day one — i.e. `savings`,
// NOT the purchase cost. Purchase costs are financed into the loan
// (`loan = price - savings + cost`) and so are already repaid through the
// monthly figures; adding them here would count them twice. Leaving the
// deposit out instead makes any purchase whose net instalment undercuts the
// rent "break even" in month 1, which is the money-out-of-pocket question
// nobody is asking.
export function calculateBreakEvenMonth(
  monthly: Array<MonthMortgageData>,
  upfrontOutlay: number,
  rent: number,
): number | null {
  let cumulativeBuy = upfrontOutlay;
  let cumulativeRent = 0;

  for (const month of monthly) {
    cumulativeBuy += month.netPaid;
    cumulativeRent += rent;
    if (cumulativeBuy <= cumulativeRent) {
      return month.month;
    }
  }

  return null;
}

export type AnnualOverpaymentBreach = {
  /** Mortgage year, 1-based: year 1 is months 1-12, year 2 is months 13-24. */
  year: number;
  overpaid: number;
  /** `overpaid` as a fraction of the original loan. */
  rate: number;
};

// Years in which the extra repaid exceeds the lender's penalty-free allowance.
// Reads the schedule's actual `overpaid` amounts rather than the raw inputs, so
// a year the loan never reaches, or a final month capped by the remaining
// balance, is reported at its real value.
//
// Grouped by mortgage year (months 1-12, 13-24, ...) rather than calendar year,
// since the schedule has no start date.
export function findAnnualOverpaymentBreaches(
  monthly: Array<MonthMortgageData>,
  loan: number,
  limitRate: number = PENALTY_FREE_OVERPAYMENT_RATE,
): Array<AnnualOverpaymentBreach> {
  if (loan <= 0) return [];

  const limit = loan * limitRate;
  const perYear = new Map<number, number>();

  for (const month of monthly) {
    if (month.overpaid <= 0) continue;
    const year = Math.ceil(month.month / MONTHS_PER_YEAR);
    perYear.set(year, (perYear.get(year) ?? 0) + month.overpaid);
  }

  return [...perYear.entries()]
    .filter(([, overpaid]) => overpaid > limit)
    .map(([year, overpaid]) => ({ year, overpaid, rate: overpaid / loan }))
    .sort((a, b) => a.year - b.year);
}
