import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

const { excludeIfRedraw } = loadScripts(
  ['namepicker/groups.js', 'namepicker/history.js'],
  { localStorage: fakeLocalStorage() },
);

const NOW = new Date(2026, 9, 28, 9, 0, 0);
const ago = seconds => new Date(NOW.getTime() - seconds * 1000).toISOString();

test('a draw within a minute of the previous one excludes the previous pick', () => {
  const history = [{ name: 'Anna', mode: 'wheel', date: ago(45) }, { name: 'Bo', mode: 'hat', date: ago(30) }];
  assert.equal(excludeIfRedraw(history, NOW), history[0]);
  assert.equal(history[0].excluded, true);
  assert.equal(history[1].excluded, undefined, 'only the newest entry is affected');
});

test('older picks, already excluded ones, undated ones and an empty history are left alone', () => {
  for (const entry of [
    { name: 'Anna', date: ago(60) },
    { name: 'Anna', date: ago(3600) },
    { name: 'Anna', date: ago(10), excluded: true },
    { name: 'Anna', date: null },
    { name: 'Anna', date: new Date(NOW.getTime() + 5000).toISOString() }, // clock moved back
  ]) {
    const before = JSON.stringify(entry);
    assert.equal(excludeIfRedraw([entry], NOW), null, before);
    assert.equal(JSON.stringify(entry), before);
  }
  assert.equal(excludeIfRedraw([], NOW), null);
});
