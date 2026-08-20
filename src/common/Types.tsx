export type MonthMortgageData = {
  month: number;
  balance: number;
  grossPaid: number;
  capitalPaid: number;
  interest: number;
  deduction: number;
  netPaid: number;
  // Capital repaid *above* the scheduled amount for this month. Always 0 on a
  // plain schedule; the annual penalty-free-limit check reads this rather than
  // the user's inputs, so it reflects what was actually applied.
  overpaid: number;
}

export type MortgageData = {
  totals: {
    totalPaidGross: number;
    totalPaidNet: number;
    totalInterestGross: number;
    totalInterestNet: number;
    totalInvestedGross: number;
    totalInvestedNet: number;
    payoffMonth: number;
  };
  monthly: Array<MonthMortgageData>;
};

export type Overpayment = {
  /** Extra capital repaid every month. */
  monthly: number;
  /** Extra capital repaid once a year, on `monthOfYear` (1 = Jan ... 12 = Dec). */
  yearly?: { amount: number; monthOfYear: number };
  /** A single one-off extra repayment on an absolute month of the schedule. */
  lumpSum?: { month: number; amount: number };
};
