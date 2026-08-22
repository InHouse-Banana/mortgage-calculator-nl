import {
  calculateAnnuityData,
  calculateLinearData,
  calgulateLoanFigures,
  calculateBreakEvenMonth,
  effectiveAnnualRate,
  rentForMonth,
  totalRentOverTerm,
} from '../Formulas';
import { AppState } from '../../App';
import {
  DEFAULT_YEARLY_OVERPAYMENT_MONTH,
  MAX_NHG,
  NHG_FEE,
} from '../constants';

// These tests check the engine against arithmetic derived OUTSIDE it —
// closed-form formulas and published payment figures — rather than against
// numbers the engine itself produced. A self-consistent but wrong model
// passes the invariant tests; it does not pass these.

const MONTH = (annualRate: number) => annualRate / (12 * 100);

/** Standard annuity payment, written independently of Formulas.tsx. */
function referencePayment(loan: number, annualRate: number, months: number) {
  const r = MONTH(annualRate);
  if (r === 0) return loan / months;
  return (loan * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * Closed form for a linear schedule's total interest.
 * Balance in month i (0-based) is L - (L/n)i, so the interest sum is
 * r * Σ(L - Li/n) = r * L * (n + 1) / 2.
 */
function referenceLinearInterest(loan: number, annualRate: number, months: number) {
  return (MONTH(annualRate) * loan * (months + 1)) / 2;
}

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    price: 400000,
    notary: 1200,
    valuation: 800,
    financialAdvisor: 2500,
    realStateAgent: 3327.5,
    structuralSurvey: 800,
    otherCosts: 0,
    savings: 50000,
    interest: 4.0,
    deduction: 36.93,
    rent: 1600,
    rentIncrease: 0,
    termYears: 30,
    costEnabled: {
      notary: true,
      valuation: true,
      financialAdvisor: true,
      realStateAgent: true,
      structuralSurvey: true,
      transferTax: true,
      bankGuarantee: true,
      nhg: true,
      otherCosts: true,
    },
    overpaymentMonthly: 0,
    overpaymentYearly: 0,
    overpaymentYearlyMonth: DEFAULT_YEARLY_OVERPAYMENT_MONTH,
    overpaymentLumpSumMonth: 0,
    overpaymentLumpSumAmount: 0,
    ...overrides,
  };
}

describe('matches published mortgage payment figures', () => {
  // Reference payments computed outside this codebase (CPython, float64) from
  // the standard annuity formula L*r / (1 - (1+r)^-n).
  it.each([
    ['300,000 at 4.00% over 30y', 300000, 4.0, 360, 1432.2459],
    ['100,000 at 6.00% over 30y', 100000, 6.0, 360, 599.5505],
    ['250,000 at 3.50% over 25y', 250000, 3.5, 300, 1251.5589],
    ['200,000 at 5.00% over 15y', 200000, 5.0, 180, 1581.5873],
  ])('%s', (_label, loan, rate, months, expected) => {
    const data = calculateAnnuityData(rate, 0, 0, loan, months);

    expect(data.monthly[0].grossPaid).toBeCloseTo(expected, 3);
    expect(referencePayment(loan, rate, months)).toBeCloseTo(expected, 3);
  });
});

describe('agrees with closed-form totals', () => {
  const CASES: Array<[string, number, number, number]> = [
    ['starter, low rate', 300000, 1.5, 360],
    ['mid, typical rate', 450000, 4.0, 360],
    ['high, high rate', 750000, 6.5, 360],
    ['short term', 250000, 3.0, 120],
    ['odd term', 386500, 3.89, 324],
  ];

  it.each(CASES)('annuity totals: %s', (_l, loan, rate, months) => {
    const data = calculateAnnuityData(rate, 0, 0, loan, months);
    const payment = referencePayment(loan, rate, months);

    // A level payment for the whole term means total paid is exactly n x PMT.
    expect(data.totals.totalPaidGross).toBeCloseTo(payment * months, 4);
    expect(data.totals.totalInterestGross).toBeCloseTo(
      payment * months - loan,
      4,
    );
  });

  it.each(CASES)('linear totals: %s', (_l, loan, rate, months) => {
    const data = calculateLinearData(rate, 0, 0, loan, months);

    expect(data.totals.totalInterestGross).toBeCloseTo(
      referenceLinearInterest(loan, rate, months),
      4,
    );
    expect(data.totals.totalPaidGross).toBeCloseTo(
      loan + referenceLinearInterest(loan, rate, months),
      4,
    );
  });
});

describe('degenerate but legal inputs behave sanely', () => {
  it('charges no interest at a 0% rate', () => {
    const annuity = calculateAnnuityData(0, 0, 0, 300000, 360);
    const linear = calculateLinearData(0, 0, 0, 300000, 360);

    [annuity, linear].forEach((data) => {
      expect(data.totals.totalInterestGross).toBeCloseTo(0, 6);
      expect(data.totals.totalPaidGross).toBeCloseTo(300000, 6);
      // Both degenerate to the same thing: capital spread evenly.
      data.monthly.forEach((m) =>
        expect(m.capitalPaid).toBeCloseTo(300000 / 360, 6),
      );
    });
  });

  it('produces an empty-but-valid schedule for a zero loan', () => {
    const data = calculateAnnuityData(4, 36.93, 0, 0, 360);

    expect(data.totals.totalPaidGross).toBeCloseTo(0, 6);
    data.monthly.forEach((m) => {
      expect(m.balance).toBe(0);
      expect(m.grossPaid).toBeCloseTo(0, 6);
    });
  });

  it('makes net equal gross with no tax deduction', () => {
    const data = calculateAnnuityData(4, 0, 0, 300000, 360);
    data.monthly.forEach((m) => {
      expect(m.deduction).toBe(0);
      expect(m.netPaid).toBeCloseTo(m.grossPaid, 9);
    });
  });

  it('makes net equal capital with a 100% deduction', () => {
    const data = calculateAnnuityData(4, 100, 0, 300000, 360);
    data.monthly.forEach((m) => {
      expect(m.deduction).toBeCloseTo(m.interest, 9);
      expect(m.netPaid).toBeCloseTo(m.capitalPaid, 9);
    });
  });

  it('handles a single-month term', () => {
    const data = calculateAnnuityData(6, 0, 0, 10000, 1);

    expect(data.monthly).toHaveLength(1);
    expect(data.monthly[0].capitalPaid).toBeCloseTo(10000, 6);
    expect(data.monthly[0].interest).toBeCloseTo(10000 * MONTH(6), 6);
  });
});

describe('responds to each input in the right direction', () => {
  const loan = 400000;

  it('costs more interest at a higher rate', () => {
    const rates = [1, 2, 3, 4, 5, 6, 7];
    const totals = rates.map(
      (r) => calculateAnnuityData(r, 0, 0, loan, 360).totals.totalInterestGross,
    );
    totals.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(totals[i]));
  });

  it('lowers the payment but raises total interest on a longer term', () => {
    const terms = [120, 180, 240, 300, 360];
    const payments = terms.map(
      (n) => calculateAnnuityData(4, 0, 0, loan, n).monthly[0].grossPaid,
    );
    const interest = terms.map(
      (n) => calculateAnnuityData(4, 0, 0, loan, n).totals.totalInterestGross,
    );

    payments.slice(1).forEach((p, i) => expect(p).toBeLessThan(payments[i]));
    interest.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(interest[i]));
  });

  it('never pays off later when overpaying more', () => {
    const payoffs = [0, 50, 100, 250, 500, 1000].map(
      (monthly) =>
        calculateAnnuityData(4, 0, 0, loan, 360, { monthly }).totals.payoffMonth,
    );
    payoffs.slice(1).forEach((p, i) =>
      expect(p).toBeLessThanOrEqual(payoffs[i]),
    );
    expect(payoffs[payoffs.length - 1]).toBeLessThan(payoffs[0]);
  });

  it('saves more interest the more you overpay', () => {
    const interest = [0, 100, 250, 500, 1000].map(
      (monthly) =>
        calculateAnnuityData(4, 0, 0, loan, 360, { monthly }).totals
          .totalInterestGross,
    );
    interest.slice(1).forEach((t, i) => expect(t).toBeLessThan(interest[i]));
  });

  it('needs a bigger loan the less you bring in savings', () => {
    const loans = [0, 25000, 50000, 100000].map(
      (savings) => calgulateLoanFigures(baseState({ savings })).loan,
    );
    loans.slice(1).forEach((l, i) => expect(l).toBeLessThan(loans[i]));
  });
});

describe('annuity and linear have the right shapes', () => {
  const loan = 400000;
  const annuity = calculateAnnuityData(4, 36.93, 0, loan, 360);
  const linear = calculateLinearData(4, 36.93, 0, loan, 360);

  it('keeps the annuity payment level and shifts interest into capital', () => {
    annuity.monthly.slice(1).forEach((m, i) => {
      expect(m.grossPaid).toBeCloseTo(annuity.monthly[i].grossPaid, 6);
      expect(m.capitalPaid).toBeGreaterThan(annuity.monthly[i].capitalPaid);
      expect(m.interest).toBeLessThan(annuity.monthly[i].interest);
    });
  });

  it('keeps linear capital flat and the payment falling', () => {
    linear.monthly.slice(1).forEach((m, i) => {
      expect(m.capitalPaid).toBeCloseTo(linear.monthly[i].capitalPaid, 6);
      expect(m.grossPaid).toBeLessThan(linear.monthly[i].grossPaid);
      expect(m.interest).toBeLessThan(linear.monthly[i].interest);
    });
  });

  it('starts linear higher, ends it lower, and costs less overall', () => {
    expect(linear.monthly[0].grossPaid).toBeGreaterThan(
      annuity.monthly[0].grossPaid,
    );
    expect(linear.monthly[359].grossPaid).toBeLessThan(
      annuity.monthly[359].grossPaid,
    );
    expect(linear.totals.totalInterestGross).toBeLessThan(
      annuity.totals.totalInterestGross,
    );
  });

  it('runs the balance down monotonically to zero', () => {
    [annuity, linear].forEach((data) => {
      data.monthly.slice(1).forEach((m, i) => {
        expect(m.balance).toBeLessThan(data.monthly[i].balance);
      });
      const last = data.monthly[359];
      expect(last.balance - last.capitalPaid).toBeCloseTo(0, 6);
    });
  });

  it('charges first-month interest on the full loan', () => {
    [annuity, linear].forEach((data) => {
      expect(data.monthly[0].balance).toBe(loan);
      expect(data.monthly[0].interest).toBeCloseTo(loan * MONTH(4), 9);
    });
  });
});

describe('Dutch purchase costs behave correctly', () => {
  it('applies transfer tax at 2% and the bank guarantee at 0.1%', () => {
    const price = 500000; // above the NHG cap, so no NHG in the mix
    const bare = baseState({
      price,
      savings: 0,
      notary: 0,
      valuation: 0,
      financialAdvisor: 0,
      realStateAgent: 0,
      structuralSurvey: 0,
    });

    const { cost } = calgulateLoanFigures(bare);
    expect(cost).toBeCloseTo(price * 0.02 + price * 0.001, 6);
  });

  it('grants NHG at the cap and withholds it just above', () => {
    const at = calgulateLoanFigures(baseState({ price: MAX_NHG }));
    const above = calgulateLoanFigures(baseState({ price: MAX_NHG + 1 }));

    // At the cap the loan is grossed up by the NHG fee; a euro over, it is not.
    expect(at.cost - above.cost).toBeGreaterThan(1000);
    expect(at.loan).toBeCloseTo(
      (MAX_NHG - at.loan * 0 + (at.cost - NHG_FEE * at.loan) - 50000) /
        (1 - NHG_FEE),
      4,
    );
  });

  it('reduces to price minus savings when every cost is switched off', () => {
    const none = baseState({
      price: 400000,
      savings: 60000,
      costEnabled: {
        notary: false,
        valuation: false,
        financialAdvisor: false,
        realStateAgent: false,
        structuralSurvey: false,
        transferTax: false,
        bankGuarantee: false,
        nhg: false,
        otherCosts: false,
      },
    });

    const { cost, loan, percentage } = calgulateLoanFigures(none);
    expect(cost).toBe(0);
    expect(loan).toBe(340000);
    expect(percentage).toBeCloseTo(340000 / 400000, 9);
  });

  it('never returns a negative loan when savings exceed the purchase', () => {
    const rich = baseState({ price: 300000, savings: 1000000 });
    const { loan, percentage } = calgulateLoanFigures(rich);

    expect(loan).toBe(0);
    expect(percentage).toBe(0);
  });
});

describe('realistic end-to-end scenarios', () => {
  const SCENARIOS = [
    { name: 'NHG starter flat', price: 350000, savings: 40000, interest: 3.7, termYears: 30, rent: 1400 },
    { name: 'mid-market family home', price: 550000, savings: 90000, interest: 4.2, termYears: 30, rent: 2000 },
    { name: 'expensive, short term', price: 800000, savings: 250000, interest: 4.6, termYears: 20, rent: 2800 },
    { name: 'cheap, cheap money', price: 275000, savings: 30000, interest: 1.4, termYears: 30, rent: 1250 },
    { name: 'high rate, long term', price: 425000, savings: 45000, interest: 6.8, termYears: 30, rent: 1750 },
  ];

  it.each(SCENARIOS)('$name', (scenario) => {
    const state = baseState(scenario);
    const { loan, cost, percentage } = calgulateLoanFigures(state);
    const months = state.termYears * 12;

    const annuity = calculateAnnuityData(state.interest, state.deduction, state.savings, loan, months);
    const linear = calculateLinearData(state.interest, state.deduction, state.savings, loan, months);

    // Costs land in a believable Dutch range: 2% transfer tax dominates.
    expect(cost).toBeGreaterThan(scenario.price * 0.02);
    expect(cost).toBeLessThan(scenario.price * 0.08);

    // You always borrow more than price minus savings, because costs are financed.
    expect(loan).toBeGreaterThan(scenario.price - scenario.savings);
    expect(percentage).toBeCloseTo(loan / scenario.price, 9);

    [annuity, linear].forEach((data) => {
      expect(data.monthly).toHaveLength(months);
      // Repays exactly the loan, no more.
      expect(data.monthly.reduce((a, m) => a + m.capitalPaid, 0)).toBeCloseTo(loan, 4);
      // Interest is positive but never absurd relative to the loan.
      expect(data.totals.totalInterestGross).toBeGreaterThan(0);
      expect(data.totals.totalInterestGross).toBeLessThan(loan * 2);
      // The deduction lowers the net cost, but never below the capital repaid.
      expect(data.totals.totalPaidNet).toBeLessThan(data.totals.totalPaidGross);
      expect(data.totals.totalPaidNet).toBeGreaterThan(loan);
    });

    // Annuity's level payment is affordable relative to the rent being replaced.
    expect(annuity.monthly[0].grossPaid).toBeGreaterThan(0);
    expect(annuity.monthly[0].grossPaid).toBeCloseTo(
      referencePayment(loan, state.interest, months),
      6,
    );

    const breakEven = calculateBreakEvenMonth(annuity.monthly, cost, scenario.rent);
    if (breakEven !== null) {
      expect(breakEven).toBeGreaterThan(0);
      expect(breakEven).toBeLessThanOrEqual(months);
    }
  });
});

describe('rent-vs-buy break-even counts the money actually out of pocket', () => {
  // Reported scenario: 310k, 40k savings, 4.62%, 30y, 1,600 rent, all costs off.
  const state = baseState({
    price: 310000,
    savings: 40000,
    interest: 4.62,
    rent: 1600,
    rentIncrease: 0,
    termYears: 30,
    costEnabled: {
      notary: false,
      valuation: false,
      financialAdvisor: false,
      realStateAgent: false,
      structuralSurvey: false,
      transferTax: false,
      bankGuarantee: false,
      nhg: false,
      otherCosts: false,
    },
  });

  const { loan, cost } = calgulateLoanFigures(state);
  const annuity = calculateAnnuityData(
    state.interest,
    state.deduction,
    state.savings,
    loan,
    360,
  );

  it('reproduces the reported totals', () => {
    expect(loan).toBe(270000);
    expect(cost).toBe(0);
    expect(state.rent * 360).toBe(576000);
    expect(576000 - annuity.totals.totalInvestedGross).toBeCloseTo(36547, 0);
    expect(576000 - annuity.totals.totalInvestedNet).toBeCloseTo(121284, 0);
  });

  it('does not break even in month 1 while a deposit is unrecovered', () => {
    const month = calculateBreakEvenMonth(annuity.monthly, state.savings, state.rent);

    // The net payment (~1,003) is below the 1,600 rent, so month-to-month
    // buying wins immediately — but 40,000 of own money went in on day one and
    // has to be earned back first.
    expect(annuity.monthly[0].netPaid).toBeLessThan(state.rent);
    expect(month).not.toBe(1);
    expect(month).toBeGreaterThan(60);
    expect(month).toBeLessThan(80);
  });

  it('matches a hand-rolled cumulative comparison', () => {
    const month = calculateBreakEvenMonth(annuity.monthly, state.savings, state.rent);

    let buy = state.savings;
    let rent = 0;
    let expected: number | null = null;
    for (const m of annuity.monthly) {
      buy += m.netPaid;
      rent += state.rent;
      if (buy <= rent) {
        expected = m.month;
        break;
      }
    }
    expect(month).toBe(expected);
  });

  it('breaks even in month 1 only when nothing was put down', () => {
    expect(calculateBreakEvenMonth(annuity.monthly, 0, state.rent)).toBe(1);
  });

  it('pushes break-even later the bigger the deposit', () => {
    const months = [0, 10000, 40000, 80000].map((deposit) =>
      calculateBreakEvenMonth(annuity.monthly, deposit, state.rent),
    );
    months.slice(1).forEach((m, i) => {
      expect(m).not.toBeNull();
      expect(m!).toBeGreaterThan(months[i]!);
    });
  });

  it('returns null when renting always stays cheaper', () => {
    expect(calculateBreakEvenMonth(annuity.monthly, state.savings, 300)).toBeNull();
  });
});

describe('nominal vs effective interest rate', () => {
  it('derives the instalment from rate/12, as lenders do', () => {
    // 6% nominal = 0.5%/month. First-month interest on 100,000 is exactly 500.
    const data = calculateAnnuityData(6, 0, 0, 100000, 360);
    expect(data.monthly[0].interest).toBeCloseTo(500, 9);
  });

  it('reports the effective rate that monthly compounding implies', () => {
    // (1 + 0.06/12)^12 - 1 = 6.16778%
    expect(effectiveAnnualRate(6)).toBeCloseTo(6.167781, 5);
    expect(effectiveAnnualRate(4.62)).toBeCloseTo(4.719095, 5);
    expect(effectiveAnnualRate(0)).toBe(0);
  });

  it('is always at or above the nominal rate, and equal only at zero', () => {
    [0, 0.5, 1, 2, 3.5, 4.62, 6, 10].forEach((nominal) => {
      expect(effectiveAnnualRate(nominal)).toBeGreaterThanOrEqual(nominal);
    });
    expect(effectiveAnnualRate(0)).toBe(0);
    expect(effectiveAnnualRate(6)).toBeGreaterThan(6);
  });

  it('would give different instalments under the compounding convention', () => {
    // Documents the alternative: an effective-rate conversion produces a
    // materially lower payment that matches no published mortgage table.
    const loan = 300000;
    const nominalPayment = calculateAnnuityData(6, 0, 0, loan, 360).monthly[0]
      .grossPaid;

    const compoundedMonthly = Math.pow(1.06, 1 / 12) - 1;
    const altPayment =
      (loan * compoundedMonthly) / (1 - Math.pow(1 + compoundedMonthly, -360));

    expect(nominalPayment).toBeCloseTo(1798.65, 2); // published figure
    expect(altPayment).toBeLessThan(nominalPayment);
    expect(nominalPayment - altPayment).toBeGreaterThan(20);
  });
});

describe('net cost rises over an annuity term (tax deduction shrinking)', () => {
  // Looks wrong at a glance — the gross payment never changes, yet the net
  // column climbs month after month. It is correct and unavoidable: the
  // deduction is a percentage of the interest, the interest falls as the
  // balance falls, so net = gross - deduction necessarily rises.
  const loan = 270000;
  const data = calculateAnnuityData(4.62, 36.93, 0, loan, 360);

  it('holds the gross payment level', () => {
    data.monthly.forEach((m) =>
      expect(m.grossPaid).toBeCloseTo(data.monthly[0].grossPaid, 6),
    );
  });

  it('shrinks the interest and the deduction together, every month', () => {
    data.monthly.slice(1).forEach((m, i) => {
      expect(m.interest).toBeLessThan(data.monthly[i].interest);
      expect(m.deduction).toBeLessThan(data.monthly[i].deduction);
      expect(m.deduction).toBeCloseTo(m.interest * 0.3693, 6);
    });
  });

  it('therefore raises the net payment, every month', () => {
    data.monthly.slice(1).forEach((m, i) => {
      expect(m.netPaid).toBeGreaterThan(data.monthly[i].netPaid);
    });

    expect(data.monthly[0].netPaid).toBeCloseTo(1003.48, 2);
    expect(data.monthly[130].netPaid).toBeCloseTo(1086.72, 2);
  });

  it('does not happen without a deduction', () => {
    const noDeduction = calculateAnnuityData(4.62, 0, 0, loan, 360);
    noDeduction.monthly.forEach((m) =>
      expect(m.netPaid).toBeCloseTo(noDeduction.monthly[0].netPaid, 6),
    );
  });

  it('rises on the reported yearly-overpayment schedule too', () => {
    const withYearly = calculateAnnuityData(4.62, 36.93, 0, loan, 360, {
      monthly: 0,
      yearly: { amount: 2500, monthOfYear: 12 },
    });

    // Ignore the overpayment months, which spike by design.
    const plain = withYearly.monthly
      .slice(0, withYearly.totals.payoffMonth - 1)
      .filter((m) => m.overpaid === 0);

    plain.slice(1).forEach((m, i) =>
      expect(m.netPaid).toBeGreaterThan(plain[i].netPaid),
    );

    // Reported table: ~1,003 in month 1, past 1,130 by month 131. It climbs
    // faster than the plain schedule (1,087 at the same point) because the
    // overpayments shrink the balance, and so the interest, more quickly.
    expect(withYearly.monthly[0].netPaid).toBeCloseTo(1003.48, 2);
    expect(withYearly.monthly[130].netPaid).toBeCloseTo(1132.58, 2);
    expect(withYearly.monthly[130].netPaid).toBeGreaterThan(
      calculateAnnuityData(4.62, 36.93, 0, loan, 360).monthly[130].netPaid,
    );
  });
});

describe('the effective-rate tooltip states true numbers', () => {
  // The copy teaches with a worked example. If the arithmetic in the prose
  // ever drifts from the engine, the explanation becomes misinformation.
  it('matches the 10,000 at 6% example quoted in the tooltip', () => {
    const owedAfterAYear = 10000 * Math.pow(1 + 0.06 / 12, 12);

    expect(owedAfterAYear).toBeCloseTo(10616.78, 2);
    expect(Math.round(owedAfterAYear)).toBe(10617);
    expect(effectiveAnnualRate(6)).toBeCloseTo(6.17, 2);
  });

  it('agrees that 6% nominal is 0.5% a month', () => {
    const data = calculateAnnuityData(6, 0, 0, 10000, 12);
    expect(data.monthly[0].interest).toBeCloseTo(10000 * 0.005, 9);
  });
});

describe('other costs', () => {
  it('changes nothing when left empty', () => {
    const withField = calgulateLoanFigures(baseState({ otherCosts: 0 }));
    const disabled = calgulateLoanFigures(
      baseState({
        otherCosts: 5000,
        costEnabled: { ...baseState().costEnabled, otherCosts: false },
      }),
    );

    // Adding zero to a float sum is exact, so an untouched field cannot shift
    // any figure by even a fraction of a cent.
    expect(disabled).toEqual(withField);
  });

  it('raises the purchase cost by exactly what you enter', () => {
    const before = calgulateLoanFigures(baseState({ price: 500000 }));
    const after = calgulateLoanFigures(
      baseState({ price: 500000, otherCosts: 7500 }),
    );

    // Above the NHG cap, so nothing is grossed up and the arithmetic is direct.
    expect(after.cost - before.cost).toBeCloseTo(7500, 6);
    expect(after.loan - before.loan).toBeCloseTo(7500, 6);
  });

  it('is financed into the loan, like every other cost', () => {
    const state = baseState({ price: 350000, savings: 40000, otherCosts: 10000 });
    const { loan, cost } = calgulateLoanFigures(state);

    // Under the NHG cap the loan is grossed up, so it rises by more than the
    // 10,000 itself — the same treatment the notary and valuation get.
    const without = calgulateLoanFigures({ ...state, otherCosts: 0 });
    expect(loan - without.loan).toBeGreaterThan(10000);
    expect(cost - without.cost).toBeGreaterThan(10000);
  });

  it('drops out entirely when switched off', () => {
    const on = calgulateLoanFigures(baseState({ otherCosts: 12345 }));
    const off = calgulateLoanFigures(
      baseState({
        otherCosts: 12345,
        costEnabled: { ...baseState().costEnabled, otherCosts: false },
      }),
    );

    expect(off.cost).toBeLessThan(on.cost);
    expect(off).toEqual(calgulateLoanFigures(baseState({ otherCosts: 0 })));
  });
});

describe('expected annual rent increase', () => {
  const RENT = 1600;

  it('holds rent flat within a year and steps it at each boundary', () => {
    // 5% a year: months 1-12 at 1600, 13-24 at 1680, 25-36 at 1764.
    expect(rentForMonth(RENT, 1, 5)).toBeCloseTo(1600, 6);
    expect(rentForMonth(RENT, 12, 5)).toBeCloseTo(1600, 6);
    expect(rentForMonth(RENT, 13, 5)).toBeCloseTo(1680, 6);
    expect(rentForMonth(RENT, 24, 5)).toBeCloseTo(1680, 6);
    expect(rentForMonth(RENT, 25, 5)).toBeCloseTo(1764, 6);
    expect(rentForMonth(RENT, 37, 5)).toBeCloseTo(1600 * 1.05 ** 3, 6);
  });

  it('changes nothing at 0%', () => {
    for (const month of [1, 13, 200, 360]) {
      expect(rentForMonth(RENT, month, 0)).toBe(RENT);
    }
    expect(totalRentOverTerm(RENT, 360, 0)).toBe(RENT * 360);
  });

  it('totals the compounded rent over the term', () => {
    // 3 years at 10%: 12 x 1600 + 12 x 1760 + 12 x 1936.
    expect(totalRentOverTerm(RENT, 36, 10)).toBeCloseTo(
      12 * 1600 + 12 * 1760 + 12 * 1936,
      6,
    );
  });

  it('handles a term that stops mid-year', () => {
    // 18 months at 10%: a full year at 1600, then six months at 1760.
    expect(totalRentOverTerm(RENT, 18, 10)).toBeCloseTo(
      12 * 1600 + 6 * 1760,
      6,
    );
  });

  it('rises with the rate, and never below the flat case', () => {
    const totals = [0, 1, 2, 3, 5, 8].map((rate) =>
      totalRentOverTerm(RENT, 360, rate),
    );
    totals.slice(1).forEach((total, i) =>
      expect(total).toBeGreaterThan(totals[i]),
    );
    expect(totals[0]).toBe(RENT * 360);
  });

  it('rejects nonsense rather than producing NaN', () => {
    [NaN, Infinity, -Infinity].forEach((bad) => {
      expect(rentForMonth(RENT, 12, bad)).toBe(RENT);
      expect(totalRentOverTerm(RENT, 12, bad)).toBe(RENT * 12);
    });
    // A zero or negative term has nothing to total.
    expect(totalRentOverTerm(RENT, 0, 5)).toBe(0);
    expect(totalRentOverTerm(RENT, -12, 5)).toBe(0);
    // Month numbers below 1 fall back to the first year.
    expect(rentForMonth(RENT, 0, 5)).toBe(RENT);
  });

  // 400k, 60k down, 4% — a 359k loan at a 1,715 instalment.
  const scenario = () => {
    const state = baseState({ price: 400000, savings: 60000, interest: 4 });
    const { loan } = calgulateLoanFigures(state);
    return {
      savings: state.savings,
      monthly: calculateAnnuityData(4, 36.93, 0, loan, 360).monthly,
    };
  };

  it('brings the break-even forward, because renting gets dearer', () => {
    const { monthly, savings } = scenario();

    const flat = calculateBreakEvenMonth(monthly, savings, 1900, 0);
    const rising = calculateBreakEvenMonth(monthly, savings, 1900, 3);

    expect(flat).toBe(102);
    expect(rising).toBe(79);
  });

  it('can reach break-even where flat rent never would', () => {
    const { monthly, savings } = scenario();

    // At a flat 1,600 the buyer never catches up: the net instalment *rises*
    // as the tax deduction shrinks, while the rent stays put. Three percent a
    // year is enough to overtake it.
    expect(calculateBreakEvenMonth(monthly, savings, RENT, 0)).toBeNull();
    expect(calculateBreakEvenMonth(monthly, savings, RENT, 3)).toBe(117);
  });

  it('defaults to no increase, so existing links are unaffected', () => {
    const state = baseState({ savings: 50000 });
    const { loan } = calgulateLoanFigures(state);
    const annuity = calculateAnnuityData(4, 36.93, 0, loan, 360);

    expect(calculateBreakEvenMonth(annuity.monthly, state.savings, RENT)).toBe(
      calculateBreakEvenMonth(annuity.monthly, state.savings, RENT, 0),
    );
  });
});
