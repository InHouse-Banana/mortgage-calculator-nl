import { crc32 } from 'node:zlib';
import {
  EXPORT_COLUMNS,
  exportBasename,
  scheduleRows,
  scheduleToCsv,
  scheduleToXlsx,
} from '../export';
import { calculateAnnuityData } from '../Formulas';

const cents = (value: number) => Number(value.toFixed(2));

const schedule = calculateAnnuityData(4.62, 36.93, 0, 270000, 360, {
  monthly: 0,
  yearly: { amount: 2500, monthOfYear: 12 },
});

describe('CSV export', () => {
  const csv = scheduleToCsv(schedule.monthly);
  const lines = csv.trimEnd().split('\r\n');

  it('has a header and one line per month', () => {
    expect(lines).toHaveLength(schedule.monthly.length + 1);
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(','));
  });

  it('carries plain values — no formulas, no currency symbols', () => {
    expect(csv).not.toContain('=');
    expect(csv).not.toContain('€');
    lines.slice(1).forEach((line) => {
      expect(line.split(',')).toHaveLength(EXPORT_COLUMNS.length);
    });
  });

  it('exports cents, not the rounded euros on screen', () => {
    const [, balance, gross, capital, interest] = lines[1].split(',');

    expect(balance).toBe('270000.00');
    expect(gross).toBe('1387.37');
    expect(capital).toBe('347.87');
    expect(interest).toBe('1039.50');
    // Every money column carries exactly two decimals.
    lines[1]
      .split(',')
      .slice(1)
      .forEach((value) => expect(value).toMatch(/^-?\d+\.\d{2}$/));
  });

  it('reconciles exactly on every row, to the cent', () => {
    lines.slice(1).forEach((line) => {
      const [month, , gross, capital, interest, deduction, net] = line
        .split(',')
        .map(Number);
      expect(cents(capital + interest), `month ${month}`).toBe(gross);
      expect(cents(gross - deduction), `month ${month}`).toBe(net);
    });
  });

  it('sums to the schedule totals, so a spreadsheet agrees with the cards', () => {
    const rows = scheduleRows(schedule.monthly);
    const column = (i: number) => rows.reduce((sum, row) => sum + row[i], 0);

    // Rounding to the cent can drift half a cent per row, so a 360-row column
    // could in theory land 1.80 out. In practice the errors cancel and it is
    // a few cents — but the bound asserted is the honest one, under a euro.
    const within = (actual: number, expected: number) =>
      expect(Math.abs(actual - expected)).toBeLessThan(1);

    within(column(3), 270000); // capital repaid = the loan
    within(column(2), schedule.totals.totalPaidGross);
    within(column(6), schedule.totals.totalPaidNet);

    // And in fact far better than that bound.
    expect(Math.abs(column(3) - 270000)).toBeLessThan(0.5);
  });

  it('records the extra repayments in their own column', () => {
    const rows = scheduleRows(schedule.monthly);
    expect(rows[11][7]).toBeCloseTo(2500, 2); // month 12
    expect(rows[0][7]).toBe(0);
  });

  it('ends every line with CRLF, per RFC 4180', () => {
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });
});

describe('XLSX export', () => {
  const bytes = scheduleToXlsx(schedule.monthly, 'Annuity');

  it('is a ZIP archive', () => {
    // "PK\x03\x04"
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('contains the five parts a workbook needs', () => {
    const text = new TextDecoder('latin1').decode(bytes);
    [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
    ].forEach((part) => expect(text).toContain(part));
  });

  it('names the sheet and writes numbers as numbers', () => {
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('name="Annuity"');
    // Headers as inline strings, data as bare values — no formula elements.
    expect(text).toContain('<c r="A1" t="inlineStr"><is><t>Month</t></is></c>');
    expect(text).toContain('<c r="B2"><v>270000</v></c>');
    expect(text).not.toContain('<f>');
  });

  it('produces the same bytes for the same schedule', () => {
    // Fixed timestamps in the ZIP headers, so output is reproducible.
    expect(Array.from(scheduleToXlsx(schedule.monthly, 'Annuity'))).toEqual(
      Array.from(bytes),
    );
  });

  // Reads the archive the way an unzipper does — from the end-of-central-
  // directory record, following each recorded offset — rather than scanning for
  // signatures. Checking substrings would pass on an archive no tool can open.
  function unzip(archive: Uint8Array) {
    const view = new DataView(archive.buffer, archive.byteOffset, archive.length);

    let eocd = archive.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
    expect(eocd, 'no end-of-central-directory record').toBeGreaterThanOrEqual(0);

    const count = view.getUint16(eocd + 10, true);
    let at = view.getUint32(eocd + 16, true);
    const entries: Array<{ name: string; data: Uint8Array; crc: number }> = [];

    for (let i = 0; i < count; i++) {
      expect(view.getUint32(at, true), 'bad central record').toBe(0x02014b50);
      const nameLength = view.getUint16(at + 28, true);
      const localAt = view.getUint32(at + 42, true);

      // Follow the offset the archive itself records.
      expect(view.getUint32(localAt, true), 'bad local header').toBe(0x04034b50);
      const localNameLength = view.getUint16(localAt + 26, true);
      const size = view.getUint32(localAt + 18, true);
      const dataAt = localAt + 30 + localNameLength + view.getUint16(localAt + 28, true);

      entries.push({
        name: new TextDecoder().decode(
          archive.subarray(localAt + 30, localAt + 30 + localNameLength),
        ),
        data: archive.subarray(dataAt, dataAt + size),
        crc: view.getUint32(localAt + 14, true),
      });
      at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    return entries;
  }

  it('agrees with itself about how many entries it holds', () => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    let eocd = bytes.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;

    // Records-on-this-disk and total-records must match, or tools that read
    // the other field disagree about the contents.
    expect(view.getUint16(eocd + 8, true)).toBe(5);
    expect(view.getUint16(eocd + 10, true)).toBe(5);
  });

  it('is an archive a real unzipper can walk', () => {
    const entries = unzip(bytes);

    expect(entries.map((e) => e.name)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('records a correct CRC for every entry', () => {
    unzip(bytes).forEach((entry) => {
      // Node's own CRC32, independent of the one that wrote the file.
      expect(crc32(Buffer.from(entry.data)), entry.name).toBe(entry.crc);
      expect(entry.data.length).toBeGreaterThan(0);
    });
  });

  it('stores XML that parses, with the schedule in the sheet', () => {
    const entries = unzip(bytes);
    const parser = new DOMParser();

    entries.forEach((entry) => {
      const doc = parser.parseFromString(
        new TextDecoder().decode(entry.data),
        'application/xml',
      );
      expect(doc.querySelector('parsererror'), entry.name).toBeNull();
    });

    const sheet = entries.find((e) => e.name.endsWith('sheet1.xml'))!;
    const doc = parser.parseFromString(
      new TextDecoder().decode(sheet.data),
      'application/xml',
    );
    expect(doc.querySelectorAll('row')).toHaveLength(schedule.monthly.length + 1);
    expect(doc.querySelector('c[r="A2"] v')!.textContent).toBe('1');
  });
});

describe('filenames', () => {
  it('describes the scenario without needing to open the file', () => {
    expect(exportBasename('annuity', 30, 4.62)).toBe(
      'mortgage-schedule-annuity-30y-4-62pct',
    );
    expect(exportBasename('Linear', 27, 3.89)).toBe(
      'mortgage-schedule-linear-27y-3-89pct',
    );
  });

  it('avoids characters that break a download', () => {
    expect(exportBasename('annuity', 30, 4.62)).not.toMatch(/[.\s/\\]/);
  });
});
