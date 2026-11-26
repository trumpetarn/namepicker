import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

const np = loadScripts(
  ['groups.js', 'history.js', 'transfer.js'],
  { localStorage: fakeLocalStorage() },
);

// Objects from the scripts come from another vm realm, so compare them as JSON.
const plain = value => JSON.parse(JSON.stringify(value));

test('parseCsv handles the BOM, quotes, doubled quotes, line breaks and CRLF', () => {
  const text = '\ufeffNamn;Metod\r\n"Anna; Bo";"Säger ""hej"""\r\n"Två\nrader";\r\n';
  assert.deepEqual(plain(np.parseCsv(text)), [
    ['Namn', 'Metod'],
    ['Anna; Bo', 'Säger "hej"'],
    ['Två\nrader', ''],
  ]);
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
  const entries = np.historyFromCsv(np.historyCsv(group));
  const expected = group.history.map(e => ({ ...e, date: e.date && new Date(Math.floor(Date.parse(e.date) / 60000) * 60000).toISOString() }));
  assert.deepEqual(plain(entries), expected, 'seconds are lost, everything else stays');
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

const HEADER = 'Grupp;Namn;Metod;Datum;Tid\r\n';

test('historyFromCsv only accepts the export format', () => {
  const rejects = (text, pattern) => assert.throws(() => np.historyFromCsv(text), pattern);
  rejects('', /ingen historikexport/);
  rejects('Datum;Namn\r\n2026-01-01;Anna\r\n', /ingen historikexport/);
  rejects('Grupp,Namn,Metod,Datum,Tid\r\nG,Anna,,2026-01-01,12:00\r\n', /ingen historikexport/, 'commas');
  rejects(HEADER + 'G;Anna;Hatten;2026-01-01\r\n', /Rad 2 har 4 kolumner/);
  rejects(HEADER + 'G;Anna;;2026-01-01;12:00\r\nG; ;;2026-01-01;12:00\r\n', /Rad 3 saknar namn/);
  for (const [day, time] of [['2026-02-30', '12:00'], ['2026-1-5', '12:00'], ['2026-01-05', '24:00'], ['2026-01-05', ''], ['', '12:00'], ['5/1/2026', '12:00']]) {
    rejects(HEADER + `G;Anna;;${day};${time}\r\n`, /Rad 2 har ett ogiltigt datum/);
  }
});

test('historyFromCsv reads dates as local time, methods by name, and skips blank lines', () => {
  const entries = np.historyFromCsv('\ufeff' + HEADER + 'G;Anna;Hatten;2025-09-01;12:30\r\n\r\nG;Bo;Wheel of Names;;\r\nG;Cecilia;Lyckohjulet;2025-09-02;08:05\r\n');
  assert.deepEqual(plain(entries), [
    { name: 'Cecilia', mode: 'wheel', date: new Date(2025, 8, 2, 8, 5).toISOString() },
    { name: 'Anna', mode: 'hat', date: new Date(2025, 8, 1, 12, 30).toISOString() },
    { name: 'Bo', method: 'Wheel of Names', date: null },
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

test('excluded entries stay out of the CSV but travel in the group file', () => {
  const group = {
    name: 'G',
    names: 'Anna\nBo',
    history: [
      { name: 'Anna', mode: 'wheel', date: '2026-10-26T13:05:00.000Z', excluded: true },
      { name: 'Bo', mode: 'hat', date: '2026-10-26T12:00:00.000Z' },
    ],
  };
  assert.deepEqual(plain(np.includedEntries(group.history)).map(e => e.name), ['Bo']);
  assert.deepEqual(plain(np.historyFromCsv(np.historyCsv(group))).map(e => e.name), ['Bo']);
  assert.deepEqual(plain(np.parseGroupFile(np.groupFile(group)).history), group.history);
});

test('only excluded: true is kept from a group file', () => {
  const file = history => np.parseGroupFile(JSON.stringify({ format: 'namnvaljare-grupp', version: 1, name: 'G', names: [], history }));
  const history = file([{ name: 'A', excluded: 'yes' }, { name: 'B', excluded: 1 }, { name: 'C', excluded: true }]).history;
  assert.deepEqual(plain(history).map(e => [e.name, e.excluded]), [['A', undefined], ['B', undefined], ['C', true]]);
});

test('merging keeps an existing entry, and whether it is excluded', () => {
  const date = '2026-10-26T13:05:00.000Z';
  const existing = [{ name: 'Anna', mode: 'wheel', date, excluded: true }];
  const { history, duplicates } = np.mergeHistory(existing, [{ name: 'Anna', mode: 'wheel', date }]);
  assert.equal(duplicates, 1);
  assert.deepEqual(plain(history), existing);
});
