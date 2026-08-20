import { formatEuro, formatEuroPrefixed } from '../format';

describe('euro formatting', () => {
  it('leads with the symbol, as the rest of the UI does', () => {
    expect(formatEuro(1996)).toBe('€1,996');
    expect(formatEuro(0)).toBe('€0');
    expect(formatEuro(1234567)).toBe('€1,234,567');
    // Never trailing.
    expect(formatEuro(1996)).not.toMatch(/€$/);
  });

  it('rounds to whole euros rather than truncating', () => {
    expect(formatEuro(1995.5)).toBe('€1,996');
    expect(formatEuro(1995.49)).toBe('€1,995');
    // JS rounds halves toward +Infinity, so -1995.5 gives -1995, not -1996.
    // Only the chart uses this, where values are never negative.
    expect(formatEuro(-1995.5)).toBe('€-1,995');
  });

  it('formats prose amounts with the same leading symbol', () => {
    expect(formatEuroPrefixed(28652)).toMatch(/^€/);
    expect(formatEuroPrefixed(28652)).not.toMatch(/\d€/);
  });
});
