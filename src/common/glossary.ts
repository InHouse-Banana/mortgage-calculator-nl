// Tooltip copy. Blank lines separate paragraphs — InfoTooltip splits on them,
// so long explanations read as prose rather than a wall of text.
export const glossary = {
  nhg: `Nationale Hypotheek Garantie (NHG) is a government-backed mortgage guarantee for loans up to a set price cap.

It lowers your interest rate, but costs a one-off fee that is financed into the loan.`,

  loanToPrice: `Your mortgage as a percentage of the house price.

Above 100% means you are also borrowing to cover the purchase costs, not just the house.`,

  interestDeduction: `In the Netherlands, mortgage interest on your primary residence is deductible from taxable income at this percentage (hypotheekrenteaftrek).

It lowers your net monthly cost. Note that the net cost rises over the term: the deduction is a share of the interest, and the interest shrinks as you repay.`,

  annuity: `The total monthly payment stays the same for the whole term.

Early on you are paying mostly interest; later, mostly capital. Payments are lower at the start than a linear mortgage, but you pay more interest overall.`,

  linear: `You repay the same amount of capital every month, so the interest — and the total payment — falls steadily.

Payments start higher than an annuity, but the loan costs less in total.`,

  term: `The number of years over which the loan is repaid.

Dutch mortgages are normally 30 years, which is also the longest period the interest stays tax-deductible.

A shorter term means higher monthly payments but far less interest overall.`,

  effectiveRate: `What the nominal rate above actually costs over a year, once monthly compounding is counted (effectieve rente).

The instalment is calculated from the nominal rate divided by twelve, which is the convention every lender uses. But a nominal 6% is 0.5% a month, and 0.5% compounded twelve times is 6.17%.

Dutch lenders must quote both figures. Enter the nominal one above.`,

  yearlyOverpayment: `A single extra amount repaid once every year, in the month you choose — 12 is December, when a bonus is often available.

It stacks with any monthly extra and any one-off lump sum.

Paying earlier in the year saves more interest, because the money works against the balance for longer.`,

  penaltyFreeLimit: `Dutch lenders normally let you repay up to 10% of the original loan per year without an early-repayment fee.

This calculator warns when you exceed it, but never caps what you enter, and it does not model the fee itself. Check your own mortgage terms.`,

  transferTax: `Overdrachtsbelasting: a one-off Dutch tax on the purchase price, paid at the notary.

Modelled here at 2%. First-time buyers under 35 may be exempt — switch it off to see that scenario.`,

  bankGuarantee: `A deposit guarantee, often around 1% of the price, that some sellers require before the deal closes.

It is refunded once you complete the purchase.`,
} as const;

export type GlossaryTerm = keyof typeof glossary;
