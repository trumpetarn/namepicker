import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

// Julklappen only takes part in Jul (SEASONAL_MODES in groups.js).
const ctx = loadScripts(['js/groups.js'], {
  localStorage: fakeLocalStorage(),
  currentTheme: () => 'dark',
});
const { availableModes, modesSetting } = ctx;
const MODE_NAMES = vm.runInContext('MODE_NAMES', ctx);
const four = ['wheel', 'hat', 'slot', 'remote'];
// Arrays from the scripts' context have another Array prototype; compare copies.
const copy = x => x && JSON.parse(JSON.stringify(x));

test('Julklappen is only available in Jul, but always has a name for the history', () => {
  assert.deepEqual(copy(availableModes('dark')), four);
  assert.deepEqual(copy(availableModes('clown')), four);
  assert.deepEqual(copy(availableModes('christmas')), [...four, 'gift']);
  assert.deepEqual(copy(availableModes()), four, 'defaults to currentTheme()');
  assert.equal(MODE_NAMES.gift, 'Julklappen');
});

test('switching methods outside Jul keeps whether Julklappen is on', () => {
  // All four on, outside Jul: everything is on, so no restriction is stored
  assert.equal(modesSetting(undefined, four, four), null);
  // Hat off outside Jul: Julklappen stays on (it was, with no restriction)
  assert.deepEqual(copy(modesSetting(undefined, ['wheel', 'slot', 'remote'], four)), ['wheel', 'slot', 'remote', 'gift']);
  // Julklappen switched off in Jul, then a method changed outside Jul: it stays off
  const noGift = modesSetting(undefined, four, [...four, 'gift']);
  assert.deepEqual(copy(noGift), four);
  assert.deepEqual(copy(modesSetting(noGift, ['wheel', 'hat'], four)), ['wheel', 'hat']);
  // Back in Jul with everything on: the restriction goes away
  assert.equal(modesSetting(['wheel', 'hat'], [...four, 'gift'], [...four, 'gift']), null);
});
