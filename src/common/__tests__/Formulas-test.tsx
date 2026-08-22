import {
  calculateAnnuityData,
  calgulateLoanFigures,
  calculateLinearData,
  calculateBreakEvenMonth,
  findAnnualOverpaymentBreaches,
} from '../Formulas';
import { AppState } from '../../App';
import {
  DEFAULT_TERM_MONTHS,
  DEFAULT_TERM_YEARS,
  DEFAULT_YEARLY_OVERPAYMENT_MONTH,
} from '../constants';
import { MortgageData, Overpayment } from '../Types';

const state: AppState = {
  price: 310000,
  notary: 1200,
  valuation: 800,
  financialAdvisor: 2500,
  realStateAgent: 3000,
  structuralSurvey: 800,
  otherCosts: 0,
  savings: 40000,
  interest: 1.34,
  deduction: 36.93,
  rent: 1300,
  termYears: DEFAULT_TERM_YEARS,
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
};

// Totals are sums accumulated over hundreds of floating-point operations, so
// their last digits drift by ~1 ULP across V8 versions. Compare to 6 decimals
// (a ten-thousandth of a cent) — far tighter than any meaningful euro amount,
// but immune to that drift.
function expectTotals(
  actual: MortgageData['totals'],
  expected: MortgageData['totals'],
) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  (Object.keys(expected) as Array<keyof MortgageData['totals']>).forEach(
    (key) => expect(actual[key]).toBeCloseTo(expected[key], 6),
  );
}

it('calculates loan figures', () => {
  const figures = calgulateLoanFigures(state);

  expect(figures).toEqual({
    cost: 16529.175050301812,
    loan: 286529.1750503018,
    percentage: 0.9242876614525866,
  });
});

it('calculates annuity data', () => {
  const figures = calgulateLoanFigures(state);

  const annuityData = calculateAnnuityData(
    state.interest,
    state.deduction,
    state.savings,
    figures.loan,
  );

  expect(annuityData.monthly.length).toBe(360);

  // First month
  expect(annuityData.monthly[0]).toEqual({
    balance: 286529.1750503018,
    capitalPaid: 647.0637766049017,
    deduction: 118.16033385311871,
    grossPaid: 967.0213554110721,
    interest: 319.9575788061704,
    month: 1,
    netPaid: 848.8610215579534,
    overpaid: 0,
  });

  // 15 years
  expect(annuityData.monthly[179]).toEqual({
    balance: 158396.591597757,
    capitalPaid: 790.1451614602366,
    deduction: 65.32037842604102,
    grossPaid: 967.0213554110653,
    interest: 176.87619395082865,
    month: 180,
    netPaid: 901.7009769850243,
    overpaid: 0,
  });

  // 30 years
  expect(annuityData.monthly[359]).toEqual({
    balance: 965.9427193743177,
    capitalPaid: 965.942719374328,
    deduction: 0.398340288329178,
    grossPaid: 967.0213554109627,
    interest: 1.0786360366346548,
    month: 360,
    netPaid: 966.6230151226334,
    overpaid: 0,
  });

  expectTotals(annuityData.totals, {
    totalInterestGross: 61598.51289767987,
    totalInterestNet: 38850.18208456715,
    totalInvestedGross: 388127.6879479817,
    totalInvestedNet: 365379.357134869,
    totalPaidGross: 348127.6879479817,
    totalPaidNet: 325379.357134869,
    payoffMonth: 360,
  });
});

it('calculates linear data', () => {
  const figures = calgulateLoanFigures(state);

  const linearData = calculateLinearData(
    state.interest,
    state.deduction,
    state.savings,
    figures.loan,
  );

  expect(linearData.monthly.length).toBe(360);

  // First month
  expect(linearData.monthly[0]).toEqual({
    balance: 286529.1750503018,
    capitalPaid: 795.9143751397273,
    deduction: 118.16033385311871,
    grossPaid: 1115.8719539458978,
    interest: 319.9575788061704,
    month: 1,
    netPaid: 997.7116200927791,
    overpaid: 0,
  });

  // 15 years
  expect(linearData.monthly[179]).toEqual({
    balance: 144060.50190029063,
    capitalPaid: 795.9143751397273,
    deduction: 59.408390076151356,
    grossPaid: 956.7819355950519,
    interest: 160.86756045532454,
    month: 180,
    netPaid: 897.3735455189005,
    overpaid: 0,
  });

  // 30 years
  expect(linearData.monthly[359]).toEqual({
    balance: 795.9143751396914,
    capitalPaid: 795.9143751397273,
    deduction: 0.3282231495919817,
    grossPaid: 796.8031461919667,
    interest: 0.8887710522393221,
    month: 360,
    netPaid: 796.4749230423747,
    overpaid: 0,
  });

  expectTotals(linearData.totals, {
    totalInterestGross: 57752.342974515515,
    totalInterestNet: 36424.40271402575,
    totalInvestedGross: 384281.51802481734,
    totalInvestedNet: 362953.5777643276,
    totalPaidGross: 344281.51802481734,
    totalPaidNet: 322953.5777643276,
    payoffMonth: 360,
  });
});

it('calculates annuity data with overpayment (recurring + lump sum)', () => {
  const figures = calgulateLoanFigures(state);
  const overpayment = { monthly: 500, lumpSum: { month: 12, amount: 5000 } };

  const annuityData = calculateAnnuityData(
    state.interest,
    state.deduction,
    state.savings,
    figures.loan,
    undefined,
    overpayment,
  );

  // Re-baselined when the annuity switched to a level payment: overpaying now
  // shortens the term (217 of 360) instead of being refunded as a lower
  // instalment, which left payoff at 296 while the payment sagged every month.
  expect(annuityData.totals.payoffMonth).toBe(217);
  expectTotals(annuityData.totals, {
    totalPaidGross: 322102.72669286805,
    totalPaidNet: 308965.414071268,
    totalInterestGross: 35573.55164256622,
    totalInterestNet: 22436.239020966168,
    totalInvestedGross: 362102.72669286805,
    totalInvestedNet: 348965.414071268,
    payoffMonth: 217,
  });

  // Month 1 charges the contracted instalment plus the extra, nothing else.
  expect(annuityData.monthly[0].grossPaid).toBeCloseTo(967.0213554110721 + 500, 9);
  expect(annuityData.monthly[0].capitalPaid).toBeCloseTo(647.0637766049017 + 500, 9);

  // Lump sum applied on month 12: instalment + 500 recurring + 5000 one-off.
  expect(annuityData.monthly[11].grossPaid).toBeCloseTo(967.0213554110721 + 5500, 9);
  expect(annuityData.monthly[11].capitalPaid).toBeCloseTo(6161.232475318567);

  // Balance stays at 0 (loan settled) past the payoff month
  expect(annuityData.monthly[359].balance).toBe(0);
  expect(annuityData.monthly[359].capitalPaid).toBe(0);
});

it('calculates linear data with overpayment (recurring + lump sum)', () => {
  const figures = calgulateLoanFigures(state);
  const overpayment = { monthly: 500, lumpSum: { month: 12, amount: 5000 } };

  const linearData = calculateLinearData(
    state.interest,
    state.deduction,
    state.savings,
    figures.loan,
    undefined,
    overpayment,
  );

  expect(linearData.totals.payoffMonth).toBe(218);
  expectTotals(linearData.totals, {
    totalPaidGross: 320901.40053143,
    totalPaidNet: 308207.7376612497,
    totalInterestGross: 34372.225481128145,
    totalInterestNet: 21678.562610947876,
    totalInvestedGross: 360901.40053143,
    totalInvestedNet: 348207.7376612497,
    payoffMonth: 218,
  });

  expect(linearData.monthly[11].capitalPaid).toBeCloseTo(6295.914375139728);
  expect(linearData.monthly[359].balance).toBe(0);
  expect(linearData.monthly[359].capitalPaid).toBe(0);
});

it('calculates the break-even month vs. renting', () => {
  const figures = calgulateLoanFigures(state);
  const annuityData = calculateAnnuityData(
    state.interest,
    state.deduction,
    state.savings,
    figures.loan,
  );

  // Second argument is the buyer's own money in on day one (savings), not the
  // purchase cost — that is financed into the loan and repaid via `monthly`.
  const month = calculateBreakEvenMonth(
    annuityData.monthly,
    state.savings,
    state.rent,
  );

  let buy = state.savings;
  let rent = 0;
  let expected: number | null = null;
  for (const m of annuityData.monthly) {
    buy += m.netPaid;
    rent += state.rent;
    if (buy <= rent) {
      expected = m.month;
      break;
    }
  }
  expect(month).toBe(expected);
  expect(month).toBeGreaterThan(1);

  // Rent too low to ever beat the mortgage payment within the schedule.
  expect(
    calculateBreakEvenMonth(annuityData.monthly, state.savings, 500),
  ).toBeNull();
});

it('calculates savings vs total invested curve', () => {
  for (let s = 0; s < 21; s++) {
    state.savings = 20000 + s * 1000;
    const figures = calgulateLoanFigures(state);
    calculateAnnuityData(
      state.interest,
      state.deduction,
      state.savings,
      figures.loan,
    );
  }
});

describe('variable mortgage term', () => {
  const figures = calgulateLoanFigures(state);
  const { loan } = figures;

  function annuity(termMonths?: number, overpayment?: Overpayment) {
    return calculateAnnuityData(
      state.interest,
      state.deduction,
      state.savings,
      loan,
      termMonths,
      overpayment,
    );
  }

  function linear(termMonths?: number, overpayment?: Overpayment) {
    return calculateLinearData(
      state.interest,
      state.deduction,
      state.savings,
      loan,
      termMonths,
      overpayment,
    );
  }

  it('defaults to a 360-month schedule when no term is given', () => {
    expect(annuity().monthly.length).toBe(DEFAULT_TERM_MONTHS);
    expect(linear().monthly.length).toBe(DEFAULT_TERM_MONTHS);
    expect(DEFAULT_TERM_MONTHS).toBe(360);
  });

  it.each([
    ['25 years', 300],
    ['27 years', 324],
    ['10 years', 120],
    ['1 year', 12],
  ])('builds an annuity schedule of exactly the term: %s', (_label, term) => {
    const data = annuity(term);

    expect(data.monthly.length).toBe(term);
    expect(data.monthly[term - 1].month).toBe(term);
    expect(data.totals.payoffMonth).toBe(term);
  });

  it.each([
    ['25 years', 300],
    ['27 years', 324],
    ['10 years', 120],
    ['1 year', 12],
  ])('builds a linear schedule of exactly the term: %s', (_label, term) => {
    const data = linear(term);

    expect(data.monthly.length).toBe(term);
    expect(data.monthly[term - 1].month).toBe(term);
    expect(data.totals.payoffMonth).toBe(term);
  });

  it('fully amortizes an annuity loan over a 25-year term', () => {
    const data = annuity(300);
    const last = data.monthly[299];

    // The final month's payment clears exactly the remaining balance.
    expect(last.capitalPaid).toBeCloseTo(last.balance, 6);
    // Sum of capital repaid equals the loan.
    const capitalRepaid = data.monthly.reduce((a, m) => a + m.capitalPaid, 0);
    expect(capitalRepaid).toBeCloseTo(loan, 6);
  });

  it('fully amortizes a linear loan over a 25-year term', () => {
    const data = linear(300);

    // Linear = constant capital repayment of loan/term every month.
    data.monthly.forEach((m) => expect(m.capitalPaid).toBeCloseTo(loan / 300, 6));

    const capitalRepaid = data.monthly.reduce((a, m) => a + m.capitalPaid, 0);
    expect(capitalRepaid).toBeCloseTo(loan, 6);
    expect(data.monthly[299].balance).toBeCloseTo(loan / 300, 6);
  });

  it('charges a higher monthly payment but less total interest on a shorter term', () => {
    const long = annuity(360);
    const short = annuity(300);

    expect(short.monthly[0].grossPaid).toBeGreaterThan(long.monthly[0].grossPaid);
    expect(short.totals.totalInterestGross).toBeLessThan(
      long.totals.totalInterestGross,
    );
    expect(short.totals.totalInterestGross).toBeGreaterThan(0);
  });

  it('keeps totals consistent: interest = total repaid - loan, for any term', () => {
    [120, 240, 300, 324, 360].forEach((term) => {
      [annuity(term), linear(term)].forEach((data) => {
        expect(data.totals.totalInterestGross).toBeCloseTo(
          data.totals.totalPaidGross - loan,
          6,
        );
        expect(data.totals.totalInvestedGross).toBeCloseTo(
          data.totals.totalPaidGross + state.savings,
          6,
        );
      });
    });
  });

  it('applies overpayment within a shortened term', () => {
    const overpayment = { monthly: 500, lumpSum: { month: 12, amount: 5000 } };

    [annuity(300, overpayment), linear(300, overpayment)].forEach((data) => {
      expect(data.monthly.length).toBe(300);
      // Overpaying pays the loan off before the (already shortened) term ends.
      expect(data.totals.payoffMonth).toBeLessThan(300);
      expect(data.monthly[299].balance).toBe(0);
      expect(data.monthly[299].capitalPaid).toBe(0);
    });
  });

  it('sanitizes a non-integer or out-of-range term instead of throwing', () => {
    // 27.3 years * 12 = 327.6 months — Array(327.6) would throw a RangeError.
    expect(annuity(327.6).monthly.length).toBe(328);
    expect(linear(327.6).monthly.length).toBe(328);

    // A zero/negative term still yields at least one month.
    [0, -12].forEach((bad) => {
      expect(annuity(bad).monthly.length).toBe(1);
      expect(linear(bad).monthly.length).toBe(1);
    });

    // A non-finite term falls back to the default rather than a 1-month loan.
    expect(annuity(NaN).monthly.length).toBe(DEFAULT_TERM_MONTHS);
    expect(linear(NaN).monthly.length).toBe(DEFAULT_TERM_MONTHS);
  });
});

describe('yearly extra repayments', () => {
  const { loan } = calgulateLoanFigures(state);

  function build(overpayment: Overpayment, termMonths = DEFAULT_TERM_MONTHS) {
    return {
      annuity: calculateAnnuityData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
        overpayment,
      ),
      linear: calculateLinearData(
        state.interest,
        state.deduction,
        state.savings,
        loan,
        termMonths,
        overpayment,
      ),
    };
  }

  // The invariants that must hold for ANY combination of overpayments.
  function expectConsistent(data: MortgageData, expectedLoan = loan) {
    const { monthly, totals } = data;

    // 1. Every month is internally consistent.
    monthly.forEach((m) => {
      expect(m.balance).toBeGreaterThanOrEqual(0);
      expect(m.capitalPaid).toBeGreaterThanOrEqual(0);
      // Never repay more capital than is actually outstanding.
      expect(m.capitalPaid).toBeLessThanOrEqual(m.balance + 1e-6);
      expect(m.grossPaid).toBeCloseTo(m.capitalPaid + m.interest, 6);
      expect(m.netPaid).toBeCloseTo(m.grossPaid - m.deduction, 6);
      expect(m.deduction).toBeCloseTo((m.interest * state.deduction) / 100, 6);
      expect(m.overpaid).toBeGreaterThanOrEqual(0);
      expect(m.overpaid).toBeLessThanOrEqual(m.capitalPaid + 1e-6);
    });

    // 2. The loan is repaid exactly — no more, no less.
    const capitalRepaid = monthly.reduce((a, m) => a + m.capitalPaid, 0);
    expect(capitalRepaid).toBeCloseTo(expectedLoan, 6);

    // 3. Totals agree with the schedule they were accumulated from.
    const grossSum = monthly.reduce((a, m) => a + m.grossPaid, 0);
    const netSum = monthly.reduce((a, m) => a + m.netPaid, 0);
    expect(totals.totalPaidGross).toBeCloseTo(grossSum, 6);
    expect(totals.totalPaidNet).toBeCloseTo(netSum, 6);
    expect(totals.totalInterestGross).toBeCloseTo(
      totals.totalPaidGross - expectedLoan,
      6,
    );
    expect(totals.totalInterestNet).toBeCloseTo(
      totals.totalPaidNet - expectedLoan,
      6,
    );
    expect(totals.totalInvestedGross).toBeCloseTo(
      totals.totalPaidGross + state.savings,
      6,
    );

    // 4. Interest each month is charged on that month's opening balance.
    const monthlyRate = state.interest / (12 * 100);
    monthly.forEach((m) => {
      expect(m.interest).toBeCloseTo(m.balance * monthlyRate, 6);
    });

    // 5. Nothing is paid after the loan is settled.
    monthly.slice(totals.payoffMonth).forEach((m) => {
      expect(m.balance).toBe(0);
      expect(m.capitalPaid).toBe(0);
      expect(m.interest).toBe(0);
      expect(m.grossPaid).toBe(0);
      expect(m.netPaid).toBe(0);
    });
  }

  it('applies the yearly amount only on the configured month of the year', () => {
    const { linear } = build({
      monthly: 0,
      yearly: { amount: 6000, monthOfYear: 12 },
    });

    // Months 12, 24, 36 ... carry the extra; every other month does not.
    linear.monthly.slice(0, linear.totals.payoffMonth - 1).forEach((m) => {
      if (m.month % 12 === 0) {
        expect(m.overpaid).toBeCloseTo(6000, 6);
      } else {
        expect(m.overpaid).toBe(0);
      }
    });
  });

  it.each([1, 5, 12])(
    'honours month-of-year %i',
    (monthOfYear) => {
      const { linear } = build({
        monthly: 0,
        yearly: { amount: 6000, monthOfYear },
      });

      const hits = linear.monthly
        .filter((m) => m.overpaid > 0)
        .map((m) => m.month);

      expect(hits.length).toBeGreaterThan(1);
      hits.forEach((month) => expect((month - 1) % 12).toBe(monthOfYear - 1));
      expect(hits[0]).toBe(monthOfYear);
    },
  );

  it('saves more interest when the yearly amount lands early in the year', () => {
    const january = build({ monthly: 0, yearly: { amount: 6000, monthOfYear: 1 } });
    const december = build({ monthly: 0, yearly: { amount: 6000, monthOfYear: 12 } });

    // Same money, sitting against the balance 11 months longer.
    expect(january.annuity.totals.totalInterestGross).toBeLessThan(
      december.annuity.totals.totalInterestGross,
    );
    expect(january.linear.totals.totalInterestGross).toBeLessThan(
      december.linear.totals.totalInterestGross,
    );

    // The payoff *month* is deliberately not compared: the last annual boost
    // falls on a different month, so paying in January can still finish a
    // month later even though it costs strictly less interest.
  });

  it('stacks monthly, yearly and lump sum when they fall on the same month', () => {
    const { linear } = build({
      monthly: 200,
      yearly: { amount: 3000, monthOfYear: 12 },
      lumpSum: { month: 12, amount: 5000 },
    });

    // Month 12 carries all three; month 11 carries only the recurring one.
    expect(linear.monthly[11].overpaid).toBeCloseTo(200 + 3000 + 5000, 6);
    expect(linear.monthly[10].overpaid).toBeCloseTo(200, 6);
  });

  it('never repays more than the outstanding balance on the final month', () => {
    // A yearly amount far larger than the balance can absorb.
    const { annuity, linear } = build({
      monthly: 0,
      yearly: { amount: 100000, monthOfYear: 6 },
    });

    [annuity, linear].forEach((data) => {
      const last = data.monthly[data.totals.payoffMonth - 1];
      expect(last.capitalPaid).toBeCloseTo(last.balance, 6);
      expectConsistent(data);
    });
  });

  it.each([
    ['yearly only', { monthly: 0, yearly: { amount: 6000, monthOfYear: 12 } }],
    ['monthly + yearly', { monthly: 250, yearly: { amount: 6000, monthOfYear: 7 } }],
    [
      'all three channels',
      {
        monthly: 250,
        yearly: { amount: 6000, monthOfYear: 12 },
        lumpSum: { month: 30, amount: 15000 },
      },
    ],
    ['tiny yearly', { monthly: 0, yearly: { amount: 1, monthOfYear: 3 } }],
  ])('keeps every figure consistent: %s', (_label, overpayment) => {
    const { annuity, linear } = build(overpayment as Overpayment);
    expectConsistent(annuity);
    expectConsistent(linear);
  });

  it('stays consistent on a shortened term', () => {
    const { annuity, linear } = build(
      { monthly: 150, yearly: { amount: 4000, monthOfYear: 12 } },
      300,
    );

    expect(annuity.monthly.length).toBe(300);
    expect(linear.monthly.length).toBe(300);
    expectConsistent(annuity);
    expectConsistent(linear);
  });

  it('saves more interest than the same money paid monthly would cost extra', () => {
    const baseline = build({ monthly: 0 });
    const withYearly = build({
      monthly: 0,
      yearly: { amount: 6000, monthOfYear: 12 },
    });

    expect(withYearly.annuity.totals.totalInterestGross).toBeLessThan(
      baseline.annuity.totals.totalInterestGross,
    );
    expect(withYearly.annuity.totals.payoffMonth).toBeLessThan(
      baseline.annuity.totals.payoffMonth,
    );
    // Spreading the same yearly sum over 12 months saves strictly more,
    // because each instalment starts working sooner.
    const spread = build({ monthly: 500 });
    expect(spread.annuity.totals.totalInterestGross).toBeLessThan(
      withYearly.annuity.totals.totalInterestGross,
    );
  });

  it('reports zero overpaid on every month when there is no overpayment', () => {
    const plain = calculateLinearData(
      state.interest,
      state.deduction,
      state.savings,
      loan,
    );
    plain.monthly.forEach((m) => expect(m.overpaid).toBe(0));
  });
});

describe('penalty-free annual overpayment limit', () => {
  const { loan } = calgulateLoanFigures(state);

  function breaches(overpayment: Overpayment) {
    const data = calculateLinearData(
      state.interest,
      state.deduction,
      state.savings,
      loan,
      DEFAULT_TERM_MONTHS,
      overpayment,
    );
    return findAnnualOverpaymentBreaches(data.monthly, loan);
  }

  it('reports nothing when overpayment stays under 10% of the original loan', () => {
    // 10% of ~286.5k is ~28.6k/year; 1000/month = 12k/year.
    expect(breaches({ monthly: 1000 })).toEqual([]);
  });

  it('flags the years where overpayment exceeds 10% of the original loan', () => {
    const found = breaches({
      monthly: 0,
      yearly: { amount: 40000, monthOfYear: 6 },
    });

    expect(found.length).toBeGreaterThan(0);
    found.forEach((b) => {
      expect(b.overpaid).toBeGreaterThan(loan * 0.1);
      expect(b.rate).toBeCloseTo(b.overpaid / loan, 9);
      expect(b.year).toBeGreaterThanOrEqual(1);
    });
    expect(found[0].year).toBe(1);
    expect(found[0].overpaid).toBeCloseTo(40000, 6);
  });

  it('groups by mortgage year, so a lump sum lands in the right one', () => {
    // Month 30 falls in year 3 (months 25-36).
    const found = breaches({ monthly: 0, lumpSum: { month: 30, amount: 50000 } });

    expect(found.map((b) => b.year)).toEqual([3]);
    expect(found[0].overpaid).toBeCloseTo(50000, 6);
  });

  it('does not flag a year the loan never reaches', () => {
    // Large enough to settle the whole loan on month 1, so years 2+ never
    // see a payment at all and cannot be flagged.
    const found = breaches({ monthly: 0, yearly: { amount: 400000, monthOfYear: 1 } });

    expect(found.map((b) => b.year)).toEqual([1]);
    expect(found[0].overpaid).toBeLessThanOrEqual(loan);
  });
});

describe('overpayment shortens the term rather than shrinking the payment', () => {
  const { loan } = calgulateLoanFigures(state);

  // Real-world scenario from the reported bug report: 400k over 27 years at
  // 3.89%, overpaying 2,250 once a year.
  const REPORTED = { loan: 400000, interest: 3.89, term: 324, yearly: 2250 };

  function reported(overpayment?: Overpayment) {
    return {
      annuity: calculateAnnuityData(
        REPORTED.interest,
        state.deduction,
        0,
        REPORTED.loan,
        REPORTED.term,
        overpayment,
      ),
      linear: calculateLinearData(
        REPORTED.interest,
        state.deduction,
        0,
        REPORTED.loan,
        REPORTED.term,
        overpayment,
      ),
    };
  }

  it('keeps the annuity payment level between overpayments', () => {
    const { annuity } = reported({
      monthly: 0,
      yearly: { amount: REPORTED.yearly, monthOfYear: 12 },
    });

    // Months with no extra, before payoff, all charge the same instalment —
    // the whole point of an annuity. Previously this sagged month after month
    // because the payment was re-amortized over the remaining original term.
    const level = annuity.monthly
      .slice(0, annuity.totals.payoffMonth - 1)
      .filter((m) => m.overpaid === 0)
      .map((m) => m.grossPaid);

    expect(level.length).toBeGreaterThan(200);
    level.forEach((paid) => expect(paid).toBeCloseTo(level[0], 6));
  });

  it('actually shortens the annuity term when overpaying', () => {
    const plain = reported();
    const withYearly = reported({
      monthly: 0,
      yearly: { amount: REPORTED.yearly, monthOfYear: 12 },
    });

    expect(plain.annuity.totals.payoffMonth).toBe(REPORTED.term);
    expect(withYearly.annuity.totals.payoffMonth).toBeLessThan(REPORTED.term);
  });

  it('saves a comparable number of months on annuity and linear', () => {
    const withYearly = reported({
      monthly: 0,
      yearly: { amount: REPORTED.yearly, monthOfYear: 12 },
    });

    const annuitySaved = REPORTED.term - withYearly.annuity.totals.payoffMonth;
    const linearSaved = REPORTED.term - withYearly.linear.totals.payoffMonth;

    expect(annuitySaved).toBeGreaterThan(0);
    expect(linearSaved).toBeGreaterThan(0);
    // Linear front-loads capital so it still wins, but not by a whole term.
    expect(annuitySaved).toBeGreaterThan(linearSaved / 3);
  });

  it('leaves the plain annuity schedule untouched', () => {
    const { annuity } = reported();

    // No overpayment: still a flat instalment for the full term.
    annuity.monthly.forEach((m) =>
      expect(m.grossPaid).toBeCloseTo(annuity.monthly[0].grossPaid, 6),
    );
    expect(annuity.totals.payoffMonth).toBe(REPORTED.term);
  });

  it('still repays exactly the loan under the level-payment model', () => {
    [
      { monthly: 300 },
      { monthly: 0, yearly: { amount: 2250, monthOfYear: 12 } },
      { monthly: 100, lumpSum: { month: 24, amount: 20000 } },
    ].forEach((op) => {
      const { annuity } = reported(op as Overpayment);
      const repaid = annuity.monthly.reduce((a, m) => a + m.capitalPaid, 0);
      expect(repaid).toBeCloseTo(REPORTED.loan, 6);
      expect(annuity.totals.totalInterestGross).toBeCloseTo(
        annuity.totals.totalPaidGross - REPORTED.loan,
        6,
      );
    });
  });

  it('keeps the monthly-overpayment annuity level too', () => {
    const data = calculateAnnuityData(
      state.interest,
      state.deduction,
      state.savings,
      loan,
      DEFAULT_TERM_MONTHS,
      { monthly: 500 },
    );

    const paid = data.monthly
      .slice(0, data.totals.payoffMonth - 1)
      .map((m) => m.grossPaid);
    paid.forEach((p) => expect(p).toBeCloseTo(paid[0], 6));
  });
});
