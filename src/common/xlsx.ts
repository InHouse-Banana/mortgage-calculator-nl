// A minimal .xlsx writer: one sheet, plain values, no formulas and no styling.
//
// An .xlsx is a ZIP of XML parts. Writing it directly costs ~150 lines and
// keeps the bundle and the clean audit intact — the maintained SheetJS build is
// not on npm (the npm release is pinned at a version with a known advisory),
// and write-excel-file unpacks to 1.8 MB for what is, here, one grid of numbers.
//
// Entries are STORED (uncompressed), which removes any need for a deflate
// implementation. A schedule is a few hundred rows, so the size is trivial.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; bytes: Uint8Array };

function zip(entries: Array<ZipEntry>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Array<Uint8Array> = [];
  const central: Array<Uint8Array> = [];
  let offset = 0;

  // A fixed DOS timestamp (1980-01-01) keeps output byte-identical between
  // runs, so the same schedule always produces the same file.
  const DOS_TIME = 0;
  const DOS_DATE = 33;

  const u16 = (view: DataView, at: number, value: number) =>
    view.setUint16(at, value, true);
  const u32 = (view: DataView, at: number, value: number) =>
    view.setUint32(at, value, true);

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const header = new Uint8Array(30 + name.length);
    const hv = new DataView(header.buffer);
    u32(hv, 0, 0x04034b50);
    u16(hv, 4, 20); // version needed
    u16(hv, 6, 0); // flags
    u16(hv, 8, 0); // stored
    u16(hv, 10, DOS_TIME);
    u16(hv, 12, DOS_DATE);
    u32(hv, 14, crc);
    u32(hv, 18, size);
    u32(hv, 22, size);
    u16(hv, 26, name.length);
    u16(hv, 28, 0); // extra
    header.set(name, 30);

    const record = new Uint8Array(46 + name.length);
    const rv = new DataView(record.buffer);
    u32(rv, 0, 0x02014b50);
    u16(rv, 4, 20); // version made by
    u16(rv, 6, 20); // version needed
    u16(rv, 8, 0);
    u16(rv, 10, 0);
    u16(rv, 12, DOS_TIME);
    u16(rv, 14, DOS_DATE);
    u32(rv, 16, crc);
    u32(rv, 20, size);
    u32(rv, 24, size);
    u16(rv, 28, name.length);
    u16(rv, 30, 0); // extra
    u16(rv, 32, 0); // comment
    u16(rv, 34, 0); // disk
    u16(rv, 36, 0); // internal attrs
    u32(rv, 38, 0); // external attrs
    u32(rv, 42, offset);
    record.set(name, 46);

    chunks.push(header, entry.bytes);
    central.push(record);
    offset += header.length + size;
  }

  const centralSize = central.reduce((total, r) => total + r.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 4, 0);
  u16(ev, 6, 0);
  u16(ev, 8, entries.length);
  u16(ev, 10, entries.length);
  u32(ev, 12, centralSize);
  u32(ev, 16, offset);
  u16(ev, 20, 0);

  const all = [...chunks, ...central, end];
  const total = all.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index: number): string {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function sheetXml(headers: ReadonlyArray<string>, rows: Array<Array<number>>) {
  // Headers use inline strings, which avoids needing a sharedStrings part.
  const headerCells = headers
    .map(
      (label, i) =>
        `<c r="${columnName(i)}1" t="inlineStr"><is><t>${escapeXml(label)}</t></is></c>`,
    )
    .join('');

  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, i) => `<c r="${columnName(i)}${r + 2}"><v>${value}</v></c>`)
        .join('');
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join('');

  return `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${headerCells}</row>${body}</sheetData></worksheet>`;
}

export function buildXlsx(
  sheetName: string,
  headers: ReadonlyArray<string>,
  rows: Array<Array<number>>,
): Uint8Array {
  const encoder = new TextEncoder();
  const part = (name: string, xml: string) => ({
    name,
    bytes: encoder.encode(xml),
  });

  return zip([
    part(
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
    part(
      '_rels/.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    part(
      'xl/workbook.xml',
      `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    part(
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    part('xl/worksheets/sheet1.xml', sheetXml(headers, rows)),
  ]);
}
