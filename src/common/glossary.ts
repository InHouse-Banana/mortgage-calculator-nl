export const glossary = {
  nhg: 'Nationale Hypotheek Garantie (NHG): a government-backed mortgage guarantee for loans up to a set price cap. It lowers your interest rate but costs a one-off fee, financed into the loan.',
  loanToPrice: 'Loan / Price rate: your mortgage as a percentage of the house price. Above 100% means you are also borrowing to cover purchase costs.',
  interestDeduction: 'Interest (tax) deduction: in the Netherlands, mortgage interest on your primary residence is deductible from taxable income at this percentage, lowering your net monthly cost.',
  annuity: 'Annuity mortgage: the total monthly payment (capital + interest) stays the same throughout the term; early on you pay mostly interest, later mostly capital.',
  linear: 'Linear mortgage: you repay the same amount of capital every month, so interest (and the total payment) decreases steadily over time.',
  term: 'Mortgage term: the number of years over which the loan is repaid. Dutch mortgages are normally 30 years, which is also the maximum period the interest stays tax-deductible. A shorter term means higher monthly payments but far less total interest.',
  yearlyOverpayment: 'Yearly extra repayment: a single extra amount repaid once every year, on the month you choose (12 = December, when a bonus is often available). It stacks with any monthly extra and any one-off lump sum. Paying earlier in the year saves more interest, because the money works against the balance for longer.',
  penaltyFreeLimit: 'Penalty-free limit: Dutch lenders normally let you repay up to 10% of the original loan per year without an early-repayment fee. This calculator warns when you exceed it but never caps your input, and it does not model the fee itself \u2014 check your own mortgage terms.',
  effectiveRate: 'Effective annual rate (effectieve rente): what the nominal rate actually costs over a year once monthly compounding is counted. The instalment is calculated from the nominal rate divided by 12, which is the convention every lender uses \u2014 but a nominal 6% is 0.5% a month, and 0.5% compounded twelve times is 6.17%. Dutch lenders must quote both figures; enter the nominal one above.',
  transferTax: 'Transfer tax (overdrachtsbelasting): a one-off Dutch tax on the purchase price, paid at the notary, currently modeled here at 2%.',
  bankGuarantee: 'Bank guarantee: a deposit guarantee (often ~1% of the price) some sellers require before the deal closes, refunded once you complete the purchase.',
} as const;

export type GlossaryTerm = keyof typeof glossary;
