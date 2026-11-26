import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

const np = loadScripts(
  ['js/groups.js', 'js/history.js', 'js/stats.js'],
  { localStorage: fakeLocalStorage() },
);
const plain = value => JSON.parse(JSON.stringify(value));
const NOW = new Date(2026, 9, 27, 12, 0);
const day = (y, m, d) => new Date(y, m - 1, d, 9, 0).toISOString();

const HISTORY = [
  { name: 'Anna', mode: 'wheel', date: day(2026, 10, 26) },
  { name: 'Bo', mode: 'hat', date: day(2026, 10, 20) },
  { name: 'Anna', mode: 'hat', date: day(2026, 9, 1) },
  { name: 'Cecilia', method: 'Wheel of Names', date: day(2025, 12, 1) },
  { name: 'Bo', mode: 'wheel', date: day(2026, 10, 25), excluded: true },
  { name: 'David', date: null },
];

test('counts per person and method, without excluded entries, sorted by count then name', () => {
  const s = np.computeStats(HISTORY, ['Anna', 'Bo', 'Erik'], 'all', NOW);
  assert.equal(s.total, 5);
  assert.deepEqual(plain(s.perPerson), [
    { key: 'Anna', count: 2 }, { key: 'Bo', count: 1 }, { key: 'Cecilia', count: 1 },
    { key: 'David', count: 1 }, { key: 'Erik', count: 0 },
  ], 'Erik is in the list but never picked; David has no method or date');
  assert.deepEqual(plain(s.perMethod), [
    { key: 'Hatten', count: 2 }, { key: 'Lyckohjulet', count: 1 },
    { key: 'Okänd', count: 1 }, { key: 'Wheel of Names', count: 1 },
  ]);
});

test('a period leaves out older entries and entries without a date', () => {
  const total = period => np.computeStats(HISTORY, [], period, NOW).total;
  assert.equal(total('30d'), 2);
  assert.equal(total('90d'), 3);
  assert.equal(total('year'), 3);
  assert.equal(total('all'), 5);
  assert.equal(np.periodStart('all', NOW), null);
  assert.equal(np.periodStart('year', NOW).getTime(), new Date(2026, 0, 1).getTime());
});

test('method per person gets a column per common method and folds the rest into Övriga', () => {
  const methods = ['A', 'B', 'C', 'D', 'E', 'F'];
  const history = methods.flatMap((method, i) =>
    Array.from({ length: 6 - i }, () => ({ name: i % 2 ? 'Bo' : 'Anna', method, date: day(2026, 1, 1) })));
  const { matrix, total } = np.computeStats(history, [], 'all', NOW);
  assert.deepEqual(plain(matrix.columns), ['A', 'B', 'C', 'D', 'Övriga']);
  for (const row of matrix.rows) assert.equal(row.cells.reduce((a, b) => a + b, 0), row.total, row.name);
  assert.equal(matrix.rows.reduce((n, r) => n + r.total, 0), total);
  // With just one method more than fit, it keeps its name instead of becoming "Övriga"
  const five = np.computeStats(history.filter(e => e.method !== 'F'), [], 'all', NOW);
  assert.deepEqual(plain(five.matrix.columns), ['A', 'B', 'C', 'D', 'E']);
});
