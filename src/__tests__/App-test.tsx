import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// The amortization table has a header row plus one row per month.
function scheduleMonths() {
  const table = screen.getByRole('table');
  return within(table).getAllByRole('row').length - 1;
}

async function setTerm(years: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText('Mortgage term');
  await user.clear(input);
  await user.type(input, years);
  await user.tab(); // InputField commits on blur
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

it('defaults to a 30-year term', () => {
  render(<App />);

  expect(screen.getByLabelText('Mortgage term')).toHaveValue('30');
  expect(scheduleMonths()).toBe(360);
});

it.each([
  ['25', 300],
  ['27', 324],
  ['15', 180],
])('rebuilds the schedule when the term is set to %s years', async (years, months) => {
  render(<App />);

  await setTerm(years);

  expect(scheduleMonths()).toBe(months);
  expect(screen.getByText(`Rent vs. buy (${years} years)`)).toBeInTheDocument();
});

it('applies the term to the linear schedule too', async () => {
  const user = userEvent.setup();
  render(<App />);

  await setTerm('25');
  await user.click(screen.getByRole('tab', { name: 'Linear' }));

  expect(scheduleMonths()).toBe(300);
});

it('shortening the term cuts total interest', async () => {
  render(<App />);

  const interestAt = () =>
    Number(
      screen
        .getAllByLabelText('Total interest (gross)')[0]
        .getAttribute('value')!
        .replace(/,/g, ''),
    );

  const thirtyYear = interestAt();
  await setTerm('20');

  expect(interestAt()).toBeLessThan(thirtyYear);
});

it('round-trips the term through the URL', async () => {
  render(<App />);
  await setTerm('25');

  expect(new URLSearchParams(window.location.search).get('termYears')).toBe('25');
});

it('reads the term from the URL on load', () => {
  window.history.replaceState(null, '', '?termYears=27');
  render(<App />);

  expect(screen.getByLabelText('Mortgage term')).toHaveValue('27');
  expect(scheduleMonths()).toBe(324);
});

it('clamps an out-of-range term instead of breaking the schedule', async () => {
  render(<App />);

  await setTerm('999');
  expect(screen.getByLabelText('Mortgage term')).toHaveValue('40');
  expect(scheduleMonths()).toBe(480);

  await setTerm('0');
  expect(screen.getByLabelText('Mortgage term')).toHaveValue('1');
  expect(scheduleMonths()).toBe(12);
});

describe('yearly extra repayments', () => {
  async function goToOverpayment() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Extra Repayments' }));
  }

  async function setField(label: string | RegExp, value: string) {
    const user = userEvent.setup();
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
    await user.tab();
  }

  const payoffMonth = () =>
    Number(
      screen
        .getAllByLabelText(/^Payoff month/)[0]
        .getAttribute('value')!
        .replace(/,/g, ''),
    );

  it('defaults to no yearly overpayment, in December', async () => {
    render(<App />);
    await goToOverpayment();

    expect(screen.getByLabelText('Extra amount per year')).toHaveValue('0');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveValue('12');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveAccessibleName(
      'Yearly payment in month (December)',
    );
    expect(payoffMonth()).toBe(360);
  });

  it('brings the payoff month forward', async () => {
    render(<App />);
    await goToOverpayment();

    await setField('Extra amount per year', '6000');

    expect(payoffMonth()).toBeLessThan(360);
  });

  // Note: the payoff *month* is not a reliable comparison here. The final
  // annual boost lands on a different month, so an earlier-in-year schedule
  // can still finish a month later. Interest saved is the honest measure.
  it('saves more interest when the yearly amount moves earlier in the year', async () => {
    render(<App />);
    await goToOverpayment();

    const interestSaved = () =>
      Number(
        screen
          .getAllByLabelText('Interest saved (gross)')[0]
          .getAttribute('value')!
          .replace(/,/g, ''),
      );

    await setField('Extra amount per year', '6000');
    const december = interestSaved();

    await setField(/^Yearly payment in month/, '1');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveAccessibleName(
      'Yearly payment in month (January)',
    );
    expect(interestSaved()).toBeGreaterThan(december);
  });

  it('stacks with the monthly extra', async () => {
    render(<App />);
    await goToOverpayment();

    await setField('Extra amount per year', '6000');
    const yearlyOnly = payoffMonth();

    await setField('Extra amount per month', '200');
    expect(payoffMonth()).toBeLessThan(yearlyOnly);
  });

  it('clamps the month of year to 1-12', async () => {
    render(<App />);
    await goToOverpayment();

    await setField(/^Yearly payment in month/, '99');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveValue('12');

    await setField(/^Yearly payment in month/, '0');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveValue('1');
  });

  it('warns past the 10% penalty-free limit, and only then', async () => {
    render(<App />);
    await goToOverpayment();

    // 10% of the ~284k loan is ~28.4k/year.
    await setField('Extra amount per year', '6000');
    expect(screen.queryAllByRole('status')).toHaveLength(0);

    await setField('Extra amount per year', '60000');
    const notices = screen.getAllByRole('status');
    expect(notices).toHaveLength(2); // one per mortgage type
    expect(notices[0]).toHaveTextContent(/penalty-free limit/i);

    await setField('Extra amount per year', '0');
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('round-trips the yearly fields through the URL', async () => {
    render(<App />);
    await goToOverpayment();

    await setField('Extra amount per year', '6000');
    await setField(/^Yearly payment in month/, '5');

    const params = new URLSearchParams(window.location.search);
    expect(params.get('overpaymentYearly')).toBe('6000');
    expect(params.get('overpaymentYearlyMonth')).toBe('5');
  });

  it('reads the yearly fields from the URL on load', async () => {
    window.history.replaceState(
      null,
      '',
      '?overpaymentYearly=6000&overpaymentYearlyMonth=3',
    );
    render(<App />);
    await goToOverpayment();

    expect(screen.getByLabelText('Extra amount per year')).toHaveValue('6,000');
    expect(screen.getByLabelText(/^Yearly payment in month/)).toHaveValue('3');
    expect(payoffMonth()).toBeLessThan(360);
  });

  it('keeps working when the term is shortened', async () => {
    const user = userEvent.setup();
    render(<App />);

    await setTerm('25');
    await user.click(screen.getByRole('tab', { name: 'Extra Repayments' }));
    await setField('Extra amount per year', '6000');

    expect(screen.getAllByLabelText(/^Payoff month/)[0]).toHaveAccessibleName(
      'Payoff month (of 300)',
    );
    expect(payoffMonth()).toBeLessThan(300);
  });
});

describe('purchase costs', () => {
  async function goToCosts() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Purchase Costs' }));
  }

  const purchaseCost = () =>
    Number(
      screen
        .getByLabelText('Purchase cost')
        .getAttribute('value')!
        .replace(/,/g, ''),
    );

  const requiredLoan = () =>
    Number(
      screen
        .getByLabelText('Required loan')
        .getAttribute('value')!
        .replace(/,/g, ''),
    );

  it('can switch off every cost, including the derived ones', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(purchaseCost()).toBeGreaterThan(0);
    await goToCosts();

    for (const label of [
      'Transfer tax',
      'Bank guarantee',
      'NHG',
      'Notary',
      'Valuation',
      'Financial advisor',
      'Real estate agent',
      'Structural survey',
    ]) {
      await user.click(screen.getByLabelText(`Include ${label} in total`));
    }

    await user.click(screen.getByRole('tab', { name: 'Mortgage' }));
    expect(purchaseCost()).toBe(0);
    // With no costs, the loan is exactly price minus savings.
    expect(requiredLoan()).toBe(310000 - 40000);
  });

  it('drops NHG from the loan when switched off', async () => {
    const user = userEvent.setup();
    render(<App />);

    const withNhg = requiredLoan();
    await goToCosts();
    await user.click(screen.getByLabelText('Include NHG in total'));
    await user.click(screen.getByRole('tab', { name: 'Mortgage' }));

    // NHG is financed into the loan, so removing it shrinks the loan.
    expect(requiredLoan()).toBeLessThan(withNhg);
  });

  it('round-trips switched-off costs and edited amounts through the URL', async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToCosts();

    await user.click(screen.getByLabelText('Include Transfer tax in total'));
    await user.click(screen.getByLabelText('Include NHG in total'));
    const notary = screen.getByLabelText('Notary');
    await user.clear(notary);
    await user.type(notary, '1500');
    await user.tab();

    const params = new URLSearchParams(window.location.search);
    expect(params.get('costsOff')!.split(',').sort()).toEqual(['nhg', 'transferTax']);
    expect(params.get('notary')).toBe('1500');
  });

  it('restores switched-off costs from the URL', async () => {
    window.history.replaceState(
      null,
      '',
      '?costsOff=transferTax,notary&notary=1500',
    );
    render(<App />);
    await goToCosts();

    expect(screen.getByLabelText('Include Transfer tax in total')).not.toBeChecked();
    expect(screen.getByLabelText('Include Notary in total')).not.toBeChecked();
    expect(screen.getByLabelText('Include NHG in total')).toBeChecked();
    expect(screen.getByLabelText('Notary')).toHaveValue('1,500');
  });

  it('omits costsOff from the URL when everything is included', () => {
    render(<App />);
    expect(new URLSearchParams(window.location.search).has('costsOff')).toBe(false);
  });

  it('round-trips the lump sum through the URL', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Extra Repayments' }));

    const amount = screen.getByLabelText('One-off lump sum amount');
    await user.clear(amount);
    await user.type(amount, '15000');
    await user.tab();

    const month = screen.getByLabelText(/^Lump sum in month/);
    await user.clear(month);
    await user.type(month, '24');
    await user.tab();

    const params = new URLSearchParams(window.location.search);
    expect(params.get('overpaymentLumpSumAmount')).toBe('15000');
    expect(params.get('overpaymentLumpSumMonth')).toBe('24');
  });
});

describe('collapsible cards', () => {
  // Purchase summary is open on arrival; the two detail cards start closed so
  // the page opens on the inputs and the headline figures.
  it.each([
    ['Purchase summary', true],
    ['Rent vs. buy (30 years)', false],
    ['Annuity vs. Linear', false],
  ])('%s starts %s and toggles both ways', async (name, startsOpen) => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByRole('button', { name: name as string });
    expect(toggle).toHaveAttribute('aria-expanded', String(startsOpen));

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', String(!startsOpen));

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', String(startsOpen));
  });

  it('groups Annuity and Linear into one card', async () => {
    const user = userEvent.setup();
    render(<App />);

    const group = screen.getByRole('button', { name: 'Annuity vs. Linear' });
    const body = document.getElementById(group.getAttribute('aria-controls')!)!;

    // Both sets of totals live in the one card, so it hides and shows both.
    expect(body).toHaveAttribute('hidden');
    expect(screen.getAllByLabelText('Total interest (gross)')).toHaveLength(2);
    expect(body).toHaveTextContent('Annuity');
    expect(body).toHaveTextContent('Linear');

    await user.click(group);
    expect(body).not.toHaveAttribute('hidden');
  });

  it('keeps the primary inputs always visible', () => {
    render(<App />);
    // "Your details" is not collapsible — it is the point of the page.
    expect(screen.queryByRole('button', { name: 'Your details' })).toBeNull();
    expect(screen.getByLabelText('House price')).toBeVisible();
  });
});

describe('master purchase-costs toggle', () => {
  const ALL_COSTS = [
    'Transfer tax',
    'Bank guarantee',
    'NHG',
    'Notary',
    'Valuation',
    'Financial advisor',
    'Real estate agent',
    'Structural survey',
  ];

  const master = () => screen.getByLabelText('Include all purchase costs in total');

  const purchaseCost = () =>
    Number(
      screen.getByLabelText('Purchase cost').getAttribute('value')!.replace(/,/g, ''),
    );

  async function goToCosts() {
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Purchase Costs' }));
  }
  async function goToMortgage() {
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Mortgage' }));
  }

  function expectAllCosts(checked: boolean) {
    ALL_COSTS.forEach((label) => {
      const box = screen.getByLabelText(`Include ${label} in total`);
      if (checked) expect(box).toBeChecked();
      else expect(box).not.toBeChecked();
    });
  }

  it('lives in the purchase summary and starts fully on', () => {
    render(<App />);

    expect(master()).toBeChecked();
    expect(master()).not.toBePartiallyChecked();
    expect(purchaseCost()).toBeGreaterThan(0);
  });

  it('switches every individual cost off in one click', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(master());

    expect(purchaseCost()).toBe(0);
    expect(master()).not.toBeChecked();

    await goToCosts();
    expectAllCosts(false);
  });

  it('switches every individual cost back on', async () => {
    const user = userEvent.setup();
    render(<App />);

    const original = purchaseCost();
    await user.click(master());
    await user.click(master());

    expect(purchaseCost()).toBeCloseTo(original, 6);
    expect(master()).toBeChecked();

    await goToCosts();
    expectAllCosts(true);
  });

  it('goes indeterminate when only some costs are on', async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToCosts();
    await user.click(screen.getByLabelText('Include Notary in total'));
    await goToMortgage();

    expect(master()).toBePartiallyChecked();
  });

  // Native checkbox semantics: clicking an indeterminate box checks it. So a
  // mixed state fills in the gaps first, and a second click clears everything.
  it('completes the set when clicked from a mixed state, then clears it', async () => {
    const user = userEvent.setup();
    render(<App />);

    const original = purchaseCost();

    await goToCosts();
    await user.click(screen.getByLabelText('Include Notary in total'));
    await goToMortgage();
    expect(master()).toBePartiallyChecked();

    await user.click(master());
    expect(master()).toBeChecked();
    expect(purchaseCost()).toBeCloseTo(original, 6);

    await user.click(master());
    expect(purchaseCost()).toBe(0);
    await goToCosts();
    expectAllCosts(false);
  });

  it('turns itself off when the last individual cost is switched off', async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToCosts();
    for (const label of ALL_COSTS) {
      await user.click(screen.getByLabelText(`Include ${label} in total`));
    }
    await goToMortgage();

    expect(master()).not.toBeChecked();
    expect(master()).not.toBePartiallyChecked();
    expect(purchaseCost()).toBe(0);
  });

  it('turns itself back on when every individual cost is restored', async () => {
    window.history.replaceState(
      null,
      '',
      '?costsOff=transferTax,bankGuarantee,nhg,notary,valuation,financialAdvisor,realStateAgent,structuralSurvey',
    );
    const user = userEvent.setup();
    render(<App />);

    expect(master()).not.toBeChecked();

    await goToCosts();
    for (const label of ALL_COSTS) {
      await user.click(screen.getByLabelText(`Include ${label} in total`));
    }
    await goToMortgage();

    expect(master()).toBeChecked();
    expect(master()).not.toBePartiallyChecked();
  });

  it('round-trips a fully-off state through the URL', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(master());

    const off = new URLSearchParams(window.location.search).get('costsOff')!.split(',');
    expect(off).toHaveLength(8);

    // A link built from that state comes back fully off.
    const search = window.location.search;
    window.history.replaceState(null, '', search);
    render(<App />);
    expect(screen.getAllByLabelText('Include all purchase costs in total')[1]).not.toBeChecked();
  });
});

describe('euro amounts are shown to the nearest euro', () => {
  const displayed = (label: string | RegExp) =>
    screen.getByLabelText(label).getAttribute('value')!;

  it('shows whole euros in the input and summary fields', () => {
    render(<App />);

    [
      'House price',
      'Own savings',
      'Current rent',
      'Purchase cost',
      'Remaining = Savings - Cost',
      'Required loan',
      'Total invested on rent',
    ].forEach((label) => {
      expect(displayed(label)).not.toMatch(/\./);
    });
  });

  it('keeps decimals on percentages and non-money fields', () => {
    render(<App />);

    // Rates would be useless rounded to whole numbers.
    expect(displayed('Interest')).toBe('4.62');
    expect(displayed('Interest deduction')).toBe('36.93');
    expect(displayed('Loan / Price rate (%)')).toMatch(/^\d+\.\d+$/);
    // Counts are already whole.
    expect(displayed('Mortgage term')).toBe('30');
  });

  it('shows whole euros in the amortization table', () => {
    render(<App />);

    const table = screen.getByRole('table');
    const cells = within(table)
      .getAllByRole('row')[1]
      .querySelectorAll('td');

    expect(cells.length).toBeGreaterThan(1);
    // Column 0 is the month number; the rest are money.
    Array.from(cells)
      .slice(1)
      .forEach((cell) => {
        expect(cell.textContent).toMatch(/^-?[\d,]+$/);
      });
  });

  it('rounds rather than truncates', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Purchase Costs' }));

    // 2750 * 1.21 = 3327.50 must show as 3,328, not 3,327.
    expect(displayed('Real estate agent')).toBe('3,328');
  });

  it('keeps full precision in the calculation behind the display', async () => {
    const user = userEvent.setup();
    render(<App />);

    // A rounded display must not feed back into state: nudging an unrelated
    // field leaves the loan exactly where it was.
    const before = displayed('Required loan');
    await user.click(screen.getByRole('tab', { name: 'Purchase Costs' }));
    await user.click(screen.getByRole('tab', { name: 'Mortgage' }));
    expect(displayed('Required loan')).toBe(before);
  });
});

describe('amortization rows reconcile as displayed', () => {
  const num = (cell: Element) =>
    Number(cell.textContent!.replace(/[,€]/g, ''));

  function rows() {
    const table = screen.getByRole('table');
    return within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => Array.from(r.querySelectorAll('td')).map(num));
  }

  // [month, balance, gross, capital, interest, deduction, net]
  function expectReconciles() {
    const all = rows();
    expect(all.length).toBeGreaterThan(100);
    all.forEach(([month, , gross, capital, interest, deduction, net]) => {
      expect(capital + interest, `month ${month} gross`).toBe(gross);
      expect(gross - deduction, `month ${month} net`).toBe(net);
    });
  }

  it('reconciles every annuity row', () => {
    render(<App />);
    expectReconciles();
  });

  it('reconciles every linear row', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Linear' }));
    expectReconciles();
  });

  it('reconciles with overpayments in play', async () => {
    window.history.replaceState(
      null,
      '',
      '?termYears=27&interest=3.89&overpaymentYearly=2250&overpaymentMonthly=175',
    );
    const user = userEvent.setup();
    render(<App />);

    expectReconciles();
    await user.click(screen.getByRole('tab', { name: 'Linear' }));
    expectReconciles();
  });

  it('stays within a euro of the true figures', async () => {
    window.history.replaceState(null, '', '?termYears=27&interest=3.89&overpaymentYearly=2250');
    render(<App />);

    // Derived-gross rounding must never drift further than the 1c-to-1e
    // rounding it replaces.
    rows().forEach(([, , gross, capital, interest]) => {
      expect(Math.abs(gross - (capital + interest))).toBe(0);
      expect(gross).toBeGreaterThanOrEqual(0);
    });
  });
});

it('rounds table cells rather than truncating them', async () => {
  // All costs off + no savings makes the loan exactly 400,000, so the linear
  // capital is 400000/324 = 1234.5679 and the month-1 interest is
  // 400000 * 3.89/1200 = 1296.6667 — both round up, both truncate down.
  window.history.replaceState(
    null,
    '',
    '?price=400000&savings=0&termYears=27&interest=3.89&deduction=36.93' +
      '&costsOff=transferTax,bankGuarantee,nhg,notary,valuation,' +
      'financialAdvisor,realStateAgent,structuralSurvey',
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('tab', { name: 'Linear' }));

  const cells = Array.from(
    within(screen.getByRole('table')).getAllByRole('row')[1].querySelectorAll('td'),
  ).map((c) => c.textContent);

  //        #      balance     gross     capital   interest  taxRet   net
  expect(cells).toEqual([
    '1',
    '400,000',
    '2,532', // 1235 + 1297
    '1,235', // 1234.5679 rounded up, not truncated to 1,234
    '1,297', // 1296.6667 rounded up, not truncated to 1,296
    '479', //   478.8600 rounded up
    '2,053', // 2532 - 479
  ]);
});

it('carries the currency in the column headers, not in every cell', () => {
  render(<App />);

  const headers = within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((h) => h.textContent);

  expect(headers).toEqual([
    '#',
    'Balance (€)',
    'Gross (€)',
    'Capital (€)',
    'Interest (€)',
    'Tax Return (€)',
    'Net (€)',
  ]);

  // No cell repeats the symbol.
  within(screen.getByRole('table'))
    .getAllByRole('cell')
    .forEach((cell) => expect(cell.textContent).not.toContain('€'));
});

describe('rent-vs-buy break-even in the UI', () => {
  const REPORTED =
    '?price=310000&interest=4.62&deduction=36.93&savings=40000&rent=1600' +
    '&termYears=30&costsOff=notary,valuation,financialAdvisor,realStateAgent,' +
    'structuralSurvey,transferTax,bankGuarantee,nhg';

  // The value is the sibling of the label span. Reading the whole card instead
  // would pass on any unrelated figure changing.
  const breakEven = (which: 'Annuity' | 'Linear') =>
    screen.getByText(`Break-even (${which})`).nextElementSibling!.textContent!;

  it('accounts for the deposit instead of breaking even in month 1', () => {
    window.history.replaceState(null, '', REPORTED);
    render(<App />);

    // 40,000 of own money went in up front; it cannot be recouped instantly.
    expect(breakEven('Annuity')).not.toMatch(/Month 1 \(/);
    expect(breakEven('Annuity')).toMatch(/Month (6[0-9]|7[0-9]) \(year [67]\)/);
    expect(breakEven('Linear')).not.toMatch(/Month 1 \(/);
  });

  it('breaks even immediately when nothing is put down', () => {
    window.history.replaceState(
      null,
      '',
      REPORTED.replace('savings=40000', 'savings=0'),
    );
    render(<App />);

    expect(breakEven('Annuity')).toMatch(/Month 1 \(year 1\)/);
  });

  it('pushes break-even out as the deposit grows', () => {
    const monthFor = (savings: number) => {
      window.history.replaceState(
        null,
        '',
        REPORTED.replace('savings=40000', `savings=${savings}`),
      );
      const { unmount } = render(<App />);
      const text = breakEven('Annuity');
      unmount();
      return Number(text.match(/Month (\d+)/)![1]);
    };

    expect(monthFor(60000)).toBeGreaterThan(monthFor(20000));
  });
});

describe('links and the effective rate', () => {
  it('links the footer to this fork, not the upstream repo', () => {
    render(<App />);

    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/InHouse-Banana/mortgage-calculator-nl',
    );
    expect(link.getAttribute('href')).not.toContain('santiago-pan');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows the effective annual rate alongside the nominal one', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Nominal 4.62% compounds monthly to 4.719095%.
    expect(screen.getByLabelText('Interest')).toHaveValue('4.62');
    expect(screen.getByLabelText('Effective annual rate')).toHaveValue('4.72');

    const interest = screen.getByLabelText('Interest');
    await user.clear(interest);
    await user.type(interest, '6');
    await user.tab();

    // 6% nominal -> 6.167781% effective.
    expect(screen.getByLabelText('Effective annual rate')).toHaveValue('6.17');
  });

  it('never shows an effective rate below the nominal one', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const rate of ['0', '1.5', '3', '7.25']) {
      const input = screen.getByLabelText('Interest');
      await user.clear(input);
      await user.type(input, rate);
      await user.tab();

      const effective = Number(
        screen.getByLabelText('Effective annual rate').getAttribute('value'),
      );
      expect(effective).toBeGreaterThanOrEqual(Number(rate) - 0.005);
    }
  });
});

describe('focus indication', () => {
  it('shows the ring only for keyboard users, not on mouse clicks', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByRole('button', { name: 'Purchase summary' });

    // A plain `focus:` ring boxes the title on every click. `focus-visible:`
    // leaves mouse clicks clean while keeping keyboard navigation traceable —
    // so the ring must be there, but gated.
    expect(toggle.className).toMatch(/focus-visible:ring/);
    expect(toggle.className).not.toMatch(/(?<!-visible):focus:ring|\bfocus:ring/);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps every collapsible card keyboard operable', async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByRole('button', { name: 'Annuity vs. Linear' });
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('info tooltips', () => {
  const icon = () => screen.getAllByRole('button', { name: 'i' })[0];

  it('opens on hover and closes when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('tooltip')).toBeNull();

    await user.hover(icon());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.unhover(icon());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  // The pointer must be able to travel onto the text to read or select it.
  // That is guaranteed structurally: the tooltip renders *inside* the element
  // carrying the mouse handlers, so a real browser fires no mouseleave when
  // moving between the two. Asserted on the structure rather than by
  // simulating the move, because jsdom/userEvent do not model relatedTarget
  // and would report a leave that a browser never emits.
  it('renders the tooltip inside the hover target, so it is reachable', async () => {
    const user = userEvent.setup();
    render(<App />);

    const button = icon();
    await user.hover(button);

    const tip = screen.getByRole('tooltip');
    const hoverTarget = button.parentElement!;

    expect(hoverTarget).toContainElement(tip);
    expect(hoverTarget).toContainElement(button);
  });

  // A tap must pin the tooltip open on its own. Focus alone is not enough to
  // rely on: mobile browsers are inconsistent about focusing a tapped button,
  // and any tap elsewhere blurs it. Focus and hover are removed here so only
  // the pin can be holding it open.
  it('pins open on tap, independently of hover and focus', async () => {
    const user = userEvent.setup();
    render(<App />);

    const button = icon();
    await user.click(button);
    act(() => button.blur());
    await user.unhover(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    // Tapping again puts it away.
    await user.click(button);
    act(() => button.blur());
    await user.unhover(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  // act() because a bare .focus() moves focus but never flushes React's
  // re-render, so the assertion would read a stale DOM.
  it('opens on keyboard focus, since keyboard users cannot hover', () => {
    render(<App />);
    const button = icon();

    act(() => button.focus());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => button.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('still opens on tap, since touch devices have no hover', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(icon());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('is dismissible with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(icon());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('extra repayments feed through to the other cards', () => {
  const BASE =
    '?price=310000&interest=4.62&deduction=36.93&savings=40000&rent=1600' +
    '&termYears=30&costsOff=notary,valuation,financialAdvisor,realStateAgent,' +
    'structuralSurvey,transferTax,bankGuarantee,nhg';

  function open(search: string) {
    window.history.replaceState(null, '', search);
    return render(<App />);
  }

  const euro = (label: string) =>
    Number(screen.getByLabelText(label).getAttribute('value')!.replace(/,/g, ''));

  const bothTotals = (label: string) =>
    screen
      .getAllByLabelText(label)
      .map((el) => Number(el.getAttribute('value')!.replace(/,/g, '')));

  it('lowers the total cost of buying in the rent-vs-buy card', () => {
    const plain = open(BASE);
    const before = {
      rent: euro('Total invested on rent'),
      gross: euro('Total rent - total cost (gross)'),
      net: euro('Total rent - total cost (net)'),
    };
    plain.unmount();

    open(`${BASE}&overpaymentYearly=2500&overpaymentYearlyMonth=12`);

    // Overpaying costs less interest, so more of the rent bill is "saved".
    expect(euro('Total rent - total cost (gross)')).toBeGreaterThan(before.gross);
    expect(euro('Total rent - total cost (net)')).toBeGreaterThan(before.net);
    // What you would have spent renting is unaffected by how you repay.
    expect(euro('Total invested on rent')).toBe(before.rent);
  });

  it('moves the break-even month', () => {
    const value = () =>
      screen.getByText('Break-even (Annuity)').nextElementSibling!.textContent!;

    const plain = open(BASE);
    const before = value();
    plain.unmount();

    open(`${BASE}&overpaymentYearly=2500&overpaymentYearlyMonth=12`);

    // Overpaying front-loads cash out of pocket, so the crossover shifts.
    expect(value()).not.toBe(before);
    expect(before).toMatch(/^Month \d+ \(year \d+\)$/);
  });

  it('lowers the totals on both sides of the Annuity vs. Linear card', () => {
    const plain = open(BASE);
    const beforeInterest = bothTotals('Total interest (gross)');
    const beforeRepaid = bothTotals('Total repaid (gross)');
    plain.unmount();

    open(`${BASE}&overpaymentYearly=2500&overpaymentYearlyMonth=12`);

    const afterInterest = bothTotals('Total interest (gross)');
    const afterRepaid = bothTotals('Total repaid (gross)');

    expect(afterInterest).toHaveLength(2);
    afterInterest.forEach((v, i) => expect(v).toBeLessThan(beforeInterest[i]));
    afterRepaid.forEach((v, i) => expect(v).toBeLessThan(beforeRepaid[i]));
  });

  it('leaves the required loan and purchase cost alone', () => {
    const plain = open(BASE);
    const before = { loan: euro('Required loan'), cost: euro('Purchase cost') };
    plain.unmount();

    open(`${BASE}&overpaymentYearly=2500&overpaymentYearlyMonth=12`);

    // How you repay cannot change what you had to borrow in the first place.
    expect(euro('Required loan')).toBe(before.loan);
    expect(euro('Purchase cost')).toBe(before.cost);
  });

  it('scales with the size of the extra repayment', () => {
    const interestFor = (yearly: number) => {
      const view = open(`${BASE}&overpaymentYearly=${yearly}`);
      const value = bothTotals('Total interest (gross)')[0];
      view.unmount();
      return value;
    };

    const none = interestFor(0);
    const some = interestFor(2500);
    const lots = interestFor(10000);

    expect(some).toBeLessThan(none);
    expect(lots).toBeLessThan(some);
  });
});

describe('label and tooltip legibility', () => {
  it('breaks the payoff-month parenthetical onto its own line', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Extra Repayments' }));

    const input = screen.getAllByLabelText(/^Payoff month/)[0];
    const label = document.querySelector(`label[for="${input.id}"]`)!;

    // "(of 360)" is a block, so it never wraps as "Payoff month (of" / "360)".
    const note = label.querySelector('span.block');
    expect(note).not.toBeNull();
    expect(note!.textContent).toBe('(of 360)');

    // The accessible name still reads as one phrase.
    expect(input).toHaveAccessibleName('Payoff month (of 360)');
  });

  it.each(['Interest saved (gross)', 'Total interest with overpayment (gross)'])(
    'keeps "%s" readable as one accessible name',
    async (name) => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('tab', { name: 'Extra Repayments' }));

      expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
    },
  );

  it('renders long tooltips as paragraphs, not one block of text', async () => {
    const user = userEvent.setup();
    render(<App />);

    // "Effective annual rate" is one of the longest entries.
    const label = screen.getByText('Effective annual rate');
    const icon = label.parentElement!.querySelector('button')!;
    await user.hover(icon);

    const tip = screen.getByRole('tooltip');
    const paragraphs = tip.querySelectorAll('span.block');

    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    paragraphs.forEach((p) => expect(p.textContent!.trim().length).toBeGreaterThan(0));
    // No stray blank-line markers left in the rendered output.
    expect(tip.textContent).not.toContain('\n\n');
  });

  it('gives tooltips room to breathe without overflowing a phone', async () => {
    const user = userEvent.setup();
    render(<App />);

    const label = screen.getByText('Effective annual rate');
    await user.hover(label.parentElement!.querySelector('button')!);

    const tip = screen.getByRole('tooltip');
    expect(tip.className).toMatch(/\bw-80\b/);
    expect(tip.className).toMatch(/max-w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
  });
});

describe('table guide', () => {
  const toggle = () => screen.getByRole('button', { name: 'How to read this table' });

  it('sits below the schedule, closed by default', () => {
    render(<App />);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');

    const body = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(body).toHaveAttribute('hidden');

    // Below the table, not above it.
    const table = screen.getByRole('table');
    expect(
      table.compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('explains every column the table actually renders', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(toggle());

    const headers = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((h) => h.textContent!.replace(' (€)', ''));

    const guide = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    headers.forEach((header) => {
      expect(within(guide).getByText(header)).toBeInTheDocument();
    });
  });

  it('states the identities the rows are built on', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(toggle());

    const guide = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(guide).toHaveTextContent('Capital + Interest');
    expect(guide).toHaveTextContent('Gross − Tax Return');
    expect(guide).toHaveTextContent('Balance × (rate ÷ 12)');
  });

  it('explains the euro-level rounding differences', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(toggle());

    const guide = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(guide).toHaveTextContent(/rounded to the nearest euro/i);
    expect(guide).toHaveTextContent(/1,991.*1,992|1,992/);
    // And that the maths itself is not rounded.
    expect(guide).toHaveTextContent(/Nothing is rounded inside the calculation/i);
  });

  it('makes clear the deduction applies to interest only', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(toggle());

    const guide = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(guide).toHaveTextContent(/Only interest qualifies/i);
    expect(guide).toHaveTextContent(/hypotheekrenteaftrek/i);
  });
});

it('puts each formula at the head of its explanation, not under the name', async () => {
  const user = userEvent.setup();
  render(<App />);

  const toggle = screen.getByRole('button', { name: 'How to read this table' });
  await user.click(toggle);
  const guide = document.getElementById(toggle.getAttribute('aria-controls')!)!;

  const term = within(guide).getByText('Interest');
  expect(term.tagName).toBe('DT');
  // The name column holds the name and nothing else.
  expect(term.textContent).toBe('Interest');

  const description = term.nextElementSibling!;
  expect(description.tagName).toBe('DD');
  // Formula first, prose after.
  const lines = description.querySelectorAll('span');
  expect(lines[0].textContent).toBe('Balance × (rate ÷ 12)');
  expect(lines[1].textContent).toMatch(/lender’s charge for that month/);
});

describe('graph presentation', () => {
  it('renders the graph tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Graph' }));

    expect(screen.getByRole('tab', { name: 'Graph' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

it('sets the table guide at the same size as the disclaimer below it', async () => {
  const user = userEvent.setup();
  render(<App />);

  const toggle = screen.getByRole('button', { name: 'How to read this table' });
  await user.click(toggle);
  const guide = document.getElementById(toggle.getAttribute('aria-controls')!)!;

  const disclaimer = screen
    .getByText('This calculator is for illustrative purposes only.')
    .closest('section')!;
  expect(disclaimer.className).toMatch(/\btext-base\b/);

  // Column names and prose match the disclaimer; formulas sit one step down,
  // so they read as annotation rather than body copy.
  const term = within(guide).getByText('Interest');
  expect(term.className).toMatch(/\btext-base\b/);

  const [formula, prose] = term.nextElementSibling!.querySelectorAll('span');
  expect(formula.className).toMatch(/\btext-sm\b/);
  expect(prose.className).toMatch(/\btext-base\b/);

  // The rounding explanation is body copy too.
  const rounding = within(guide)
    .getByText(/Why a row can look a euro out/)
    .closest('div')!;
  expect(rounding.className).toMatch(/\btext-base\b/);

  // Nothing left at the old smallest size.
  expect(guide.innerHTML).not.toMatch(/\btext-xs\b/);
});

describe('page heading', () => {
  it('sets "Revised" in italics without adding spoken emphasis', () => {
    render(<App />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAccessibleName('Mortgage Calculator Revised');

    // <i>, not <em>: a variant name set off typographically, not stressed
    // emphasis, so a screen reader should not announce it differently.
    const italic = heading.querySelector('i');
    expect(italic).not.toBeNull();
    expect(italic!.textContent).toBe('Revised');
    expect(heading.querySelector('em')).toBeNull();
  });
});

describe('schedule downloads', () => {
  let created: Array<{ blob: Blob; filename: string }>;
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;

  beforeEach(() => {
    created = [];
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    // jsdom implements neither.
    URL.createObjectURL = (blob: Blob) => {
      created.push({ blob, filename: '' });
      return 'blob:stub';
    };
    URL.revokeObjectURL = () => {};

    // Capture the filename off the anchor the download helper clicks.
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (created.length) created[created.length - 1].filename = this.download;
    };
    return () => {
      HTMLAnchorElement.prototype.click = click;
    };
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('offers both formats on the schedule tabs', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Excel' })).toBeInTheDocument();
  });

  it('names the CSV after the scenario', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '?termYears=27&interest=3.89');
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(created).toHaveLength(1);
    expect(created[0].filename).toBe('mortgage-schedule-annuity-27y-3-89pct.csv');
    expect(created[0].blob.type).toContain('text/csv');
  });

  it('names the workbook after the scenario, and the tab after the schedule', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '?termYears=27&interest=3.89');
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Linear' }));

    await user.click(screen.getByRole('button', { name: 'Download Excel' }));

    expect(created[0].filename).toBe('mortgage-schedule-linear-27y-3-89pct.xlsx');
    expect(created[0].blob.type).toContain('spreadsheetml.sheet');
  });

  it('exports the schedule you are looking at', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    const annuity = await created[0].blob.text();

    await user.click(screen.getByRole('tab', { name: 'Linear' }));
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    const linear = await created[1].blob.text();

    expect(annuity).not.toBe(linear);
    // Linear repays a constant amount of capital; annuity does not.
    const capitalOf = (csv: string, row: number) =>
      csv.trimEnd().split('\r\n')[row].split(',')[3];
    expect(capitalOf(linear, 1)).toBe(capitalOf(linear, 2));
    expect(capitalOf(annuity, 1)).not.toBe(capitalOf(annuity, 2));
  });

  it('does not offer downloads on the graph tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Graph' }));

    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
  });
});
