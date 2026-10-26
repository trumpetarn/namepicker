import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

const np = loadScripts(
  ['namepicker/groups.js', 'namepicker/history.js', 'namepicker/transfer.js'],
  { localStorage: fakeLocalStorage(), Blob, Response, DecompressionStream },
);

// Objects from the scripts come from another vm realm, so compare them as JSON.
const plain = value => JSON.parse(JSON.stringify(value));

// Reads a CSV the way the page does (minus the file and encoding handling).
const csvRows = text => np.parseCsv(text).map(row => row.map(np.unguardCell));

test('parseCsv handles the BOM, quotes, doubled quotes, line breaks and CRLF', () => {
  const text = '\ufeffNamn;Metod\r\n"Anna; Bo";"Säger ""hej"""\r\n"Två\nrader";\r\n';
  assert.deepEqual(plain(np.parseCsv(text)), [
    ['Namn', 'Metod'],
    ['Anna; Bo', 'Säger "hej"'],
    ['Två\nrader', ''],
  ]);
});

test('parseCsv picks up a comma- or tab-separated file', () => {
  assert.deepEqual(plain(np.parseCsv('Date,Name\n2025-09-01,"Per, J"\n')), [['Date', 'Name'], ['2025-09-01', 'Per, J']]);
  assert.deepEqual(plain(np.parseCsv('Date\tName\n2025-09-01\tPer')), [['Date', 'Name'], ['2025-09-01', 'Per']]);
});

test("the export's formula guard is removed again, and only that", () => {
  for (const name of ['=SUM(A1)', '+46 70', '-Bo', '@x', "'Bob", 'Anna']) {
    assert.equal(np.unguardCell(np.parseCsv(np.csvCell(name))[0][0]), name);
  }
});

test('export followed by import gives back the same history', () => {
  const group = {
    name: 'Team; "A"',
    history: [
      { name: 'Anna', mode: 'wheel', date: new Date(2026, 9, 26, 14, 5, 37).toISOString() },
      { name: '=Bo; "B"', mode: 'remote', date: new Date(2026, 9, 25, 9, 0).toISOString() },
      { name: 'Cecilia', method: 'Laserpekare', date: new Date(2026, 0, 2, 23, 59).toISOString() },
      { name: 'David', date: null },
    ],
  };
  const { entries, noDate } = np.historyFromRows(csvRows(np.historyCsv(group)));
  const expected = group.history.map(e => ({ ...e, date: e.date && new Date(Math.floor(Date.parse(e.date) / 60000) * 60000).toISOString() }));
  assert.deepEqual(plain(entries), expected, 'seconds are lost, everything else stays');
  assert.equal(noDate, 1);
});

test('mergeHistory drops exact duplicates (to the minute) and sorts newest first', () => {
  const at = (h, m, s = 0) => new Date(2026, 9, 26, h, m, s).toISOString();
  const existing = [
    { name: 'Anna', mode: 'wheel', date: at(12, 0, 41) },
    { name: 'Bo', mode: 'hat', date: at(9, 0) },
  ];
  const imported = [
    { name: 'Cecilia', mode: 'slot', date: at(13, 0) },
    { name: 'Anna', mode: 'wheel', date: at(12, 0) }, // same minute: a duplicate
    { name: 'Anna', mode: 'hat', date: at(12, 0) }, // other method: kept
    { name: 'Bo', mode: 'hat', date: at(9, 1) }, // other minute: kept
    { name: 'David', date: null },
  ];
  const { history, added, duplicates } = np.mergeHistory(existing, imported);
  assert.equal(added, 4);
  assert.equal(duplicates, 1);
  assert.deepEqual(plain(history).map(e => `${e.name} ${e.mode ?? '-'} ${e.date?.slice(11, 16) ?? ''}`), [
    `Cecilia slot ${at(13, 0).slice(11, 16)}`,
    `Anna wheel ${at(12, 0).slice(11, 16)}`,
    `Anna hat ${at(12, 0).slice(11, 16)}`,
    `Bo hat ${at(9, 1).slice(11, 16)}`,
    `Bo hat ${at(9, 0).slice(11, 16)}`,
    'David - ',
  ]);
});

// Like the old standup spreadsheets: a count table next to the history, which starts lower
// down, Excel day numbers as dates and "-" on days without a pick.
const SPREADSHEET = [
  [],
  ['', 'Länk', 'https://wheelofnames.com/x'],
  [],
  ['', 'Namn', 'Antal'],
  ['', 'Per', 2],
  ['', 'Date', 'Name', 'Method', 'Chosen but MIA', 'Comment', '', 'Name', 'Count'],
  ['', 45901, 'Malin', 'Wheel of Names', '', '', '', 'Malin', 1],
  ['', 45902, '-', '', '', 'Weekend'],
  ['', 45903, 'Per', 'fjärrkontrollen', 'Bo'],
  ['', 'okänt', 'Per', ''],
  ['', 45904],
];

test('historyFromRows reads an old spreadsheet', () => {
  const { entries, noDate } = np.historyFromRows(SPREADSHEET);
  assert.deepEqual(plain(entries), [
    { name: 'Per', mode: 'remote', date: new Date(2025, 8, 3).toISOString() },
    { name: 'Malin', method: 'Wheel of Names', date: new Date(2025, 8, 1).toISOString() },
    { name: 'Per', date: null },
  ]);
  assert.equal(noDate, 1);
});

test('historyFromRows needs a name column, and Excel dates can carry a time', () => {
  assert.equal(np.historyFromRows([['Datum', 'Antal'], ['2026-01-01', 3]]), null);
  const { entries } = np.historyFromRows([['Date', 'Name'], [45901.5, 'Anna']]);
  assert.equal(entries[0].date, new Date(2025, 8, 1, 12, 0).toISOString());
  const { entries: e1904 } = np.historyFromRows([['Date', 'Name'], [44439, 'Anna']], true);
  assert.equal(e1904[0].date, new Date(2025, 8, 1).toISOString(), 'the 1904 date system is 1462 days off');
  const { entries: bad } = np.historyFromRows([['Datum', 'Namn'], ['2026-02-30', 'Anna']]);
  assert.equal(bad[0].date, null, 'an impossible date is no date');
});

// A minimal .xlsx: a zip with the workbook, shared strings and one sheet.
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    central.push(dir, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dirSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...central, end]));
}

test('readXlsx reads cells from shared strings, inline strings and numbers', async () => {
  const xlsx = zip({
    'xl/workbook.xml': '<workbook><workbookPr/><sheets><sheet name="Data"/></sheets></workbook>',
    'xl/sharedStrings.xml': '<sst><si><t>Date</t></si><si><t>Name</t></si><si><r><t>Må</t></r><r><t xml:space="preserve">ns &amp; Co</t></r><rPh><t>x</t></rPh></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData>' +
      '<row r="2"><c r="B2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c><c r="D2" t="inlineStr"><is><t>Method</t></is></c></row>' +
      '<row r="3"><c r="B3" s="4"><v>45901</v></c><c r="C3" t="s"><v>2</v></c><c r="D3" t="str"><f>"Hatten"</f><v>Hatten</v></c></row>' +
      '<row r="4"><c r="B4" s="4"/></row>' +
      '</sheetData></worksheet>',
  });
  const { sheets, date1904 } = await np.readXlsx(xlsx);
  assert.equal(date1904, false);
  assert.deepEqual(plain(sheets[0][2]), [null, 45901, 'Måns & Co', 'Hatten']);
  assert.deepEqual(plain(np.historyFromRows(sheets[0]).entries), [
    { name: 'Måns & Co', mode: 'hat', date: new Date(2025, 8, 1).toISOString() },
  ]);
});

test('a group file survives export and import', () => {
  const group = {
    id: 'abc',
    name: 'Standup',
    names: 'Anna\n\n Bo \n',
    modes: ['wheel', 'remote'],
    history: [
      { name: 'Anna', mode: 'wheel', date: '2026-10-26T13:05:37.000Z' },
      { name: 'Bo', method: 'Wheel of Names', date: null },
    ],
  };
  assert.deepEqual(plain(np.parseGroupFile(np.groupFile(group))), {
    name: 'Standup',
    names: 'Anna\nBo',
    history: group.history,
    modes: ['wheel', 'remote'],
  });
});

test('parseGroupFile rejects files it cannot read, with a message', () => {
  const file = data => JSON.stringify({ format: 'namnvaljare-grupp', version: 1, name: 'G', names: [], ...data });
  assert.throws(() => np.parseGroupFile('{"broken'), /ingen gruppfil/);
  assert.throws(() => np.parseGroupFile(JSON.stringify({ name: 'G', names: [] })), /ingen gruppfil/);
  assert.throws(() => np.parseGroupFile(file({ version: 2 })), /formatversion 2/);
  assert.throws(() => np.parseGroupFile(file({ names: 'Anna' })), /namnlista/);
  assert.throws(() => np.parseGroupFile(file({ names: ['Anna', 3] })), /namnlista/);
  assert.throws(() => np.parseGroupFile(file({ history: {} })), /historik/);
});

test('parseGroupFile cleans what it imports', () => {
  const group = np.parseGroupFile(JSON.stringify({
    format: 'namnvaljare-grupp',
    version: 1,
    name: '   ',
    names: ['Anna'],
    modes: ['wheel', 'laser', 'hat'],
    history: [
      { name: 'Anna', mode: 'laser', method: ' Laser ', date: 'not a date' },
      { name: '' },
      null,
      { name: 'Bo', mode: 'hat', date: '2026-10-26T13:05:00Z' },
    ],
  }));
  assert.equal(group.name, 'Importerad grupp');
  assert.deepEqual(plain(group.modes), ['wheel', 'hat']);
  assert.deepEqual(plain(group.history), [
    { name: 'Anna', method: 'Laser', date: null },
    { name: 'Bo', mode: 'hat', date: '2026-10-26T13:05:00.000Z' },
  ]);

  const base = { format: 'namnvaljare-grupp', version: 1, name: 'G', names: [] };
  assert.equal(np.parseGroupFile(JSON.stringify({ ...base, modes: ['laser'] })).modes, undefined, 'none valid: all on');
  assert.equal(np.parseGroupFile(JSON.stringify({ ...base, modes: ['wheel', 'hat', 'slot', 'remote'] })).modes, undefined);
});
