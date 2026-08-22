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

  effectiveRate: `The same loan can honestly be quoted as two different percentages. This is the second one.

Your lender advertises 6%, say. Your payment is worked out by simply dividing that by twelve — 0.5% a month — which is how every lender does it.

But monthly interest builds on itself. Borrow 10,000 at 6% and repay nothing for a year and you owe 10,617, not 10,600, because month two charges interest on month one's interest. So the year really cost 6.17%.

Nothing is being overcharged: your payment still comes from the advertised rate. Keep entering that rate above. This figure exists so you can compare offers, since Dutch lenders may quote either the nominal rate or the effective one.`,

  yearlyOverpayment: `A single extra amount repaid once every year, in the month you choose — 12 is December, when a bonus is often available.

It stacks with any monthly extra and any one-off lump sum.

Paying earlier in the year saves more interest, because the money works against the balance for longer.`,

  penaltyFreeLimit: `Dutch lenders normally let you repay up to 10% of the original loan per year without an early-repayment fee.

This calculator warns when you exceed it, but never caps what you enter, and it does not model the fee itself. Check your own mortgage terms.`,

  rentIncrease: `How much you expect your rent to go up each year, as a percentage.

The increase lands once a year rather than monthly: months 1-12 pay today's rent, months 13-24 pay it plus the increase, and so on.

Leave it at 0 to compare against a rent that never moves — but note that the net cost of buying *rises* over the term as the tax deduction shrinks, so a fixed rent can look cheaper than it realistically would be.`,

  otherCosts: `Anything the list above does not cover — a kitchen, movers, buying off the ground lease (afkoop erfpacht), a bank's arrangement fee, or a renovation you are financing with the purchase.

It is treated exactly like the other costs: added to the total and financed into the loan, so it raises what you borrow rather than what you pay on the day.`,

  transferTax: `Overdrachtsbelasting: a one-off Dutch tax on the purchase price, paid at the notary.

Modelled here at 2%. First-time buyers under 35 may be exempt — switch it off to see that scenario.`,

  bankGuarantee: `A deposit guarantee, often around 1% of the price, that some sellers require before the deal closes.

It is refunded once you complete the purchase.`,
} as const;

export type GlossaryTerm = keyof typeof glossary;
