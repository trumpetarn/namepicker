import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { randomInt } = loadScripts(['random.js']);

test('randomInt stays within [0, n)', () => {
  for (const n of [1, 2, 3, 7, 10, 1000, 2 ** 31 + 1]) {
    for (let i = 0; i < 200; i++) {
      const v = randomInt(n);
      assert.ok(Number.isInteger(v) && v >= 0 && v < n, `randomInt(${n}) gave ${v}`);
    }
  }
});

test('randomInt(1) is always 0', () => {
  for (let i = 0; i < 50; i++) assert.equal(randomInt(1), 0);
});

test('randomInt hits every value with roughly equal frequency', () => {
  const n = 6;
  const draws = 60000;
  const counts = new Array(n).fill(0);
  for (let i = 0; i < draws; i++) counts[randomInt(n)]++;
  // Chi-squared with 5 degrees of freedom; 36 is roughly the one-in-a-million
  // critical value, so this only catches gross bias (e.g. a value never drawn),
  // not the ~1e-9 bias plain modulo would have; the rejection test covers that.
  const expected = draws / n;
  const chi2 = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
  assert.ok(chi2 < 36, `counts ${counts} (chi² ${chi2.toFixed(1)}) look biased`);
});

test('randomInt redraws values in the uneven tail of the 32-bit range', () => {
  // With n = 3, 2^32 % 3 = 1, so only 2^32 - 1 (0xffffffff) must be redrawn.
  const values = [0xffffffff, 0xffffffff, 5];
  const fakeCrypto = { getRandomValues: buf => { buf[0] = values.shift(); return buf; } };
  const { randomInt: rigged } = loadScripts(['random.js'], { crypto: fakeCrypto });
  assert.equal(rigged(3), 5 % 3);
  assert.equal(values.length, 0);
});
