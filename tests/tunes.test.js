import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from './load-scripts.js';

// Jul's fanfare tunes (js/tunes.js).
const ctx = loadScripts(['js/tunes.js'], { Math });
const { parseTune, pickChristmasTune } = ctx;
const TUNES = vm.runInContext('CHRISTMAS_TUNES', ctx);
// The notes of the closing C major chord (C, E, G)
const CHORD = [261.63, 329.63, 392, 523.25, 659.25, 783.99];

test('every tune parses, ends on a note of the closing C major chord, and stays short', () => {
  assert.ok(TUNES.length >= 3);
  for (const tune of TUNES) {
    const notes = parseTune(tune);
    assert.ok(notes.length > 5, tune.name);
    const last = notes[notes.length - 1];
    assert.ok(CHORD.includes(last.freq), `${tune.name} ends on C, E or G`);
    // A fanfare, not a song: with the closing chord's 1.2 s, at most 7 s. (The spotlight
    // shows the winner for 4 s; a tune may go on a little after it.)
    assert.ok(last.at + 1.2 <= 7, `${tune.name} lasts ${(last.at + 1.2).toFixed(2)} s`);
    notes.forEach((n, i) => i && assert.ok(n.at > notes[i - 1].at, `${tune.name}: notes in order`));
  }
});

test('parseTune reads lengths and rests, and refuses notes it doesn\'t know', () => {
  const notes = parseTune({ name: 't', unit: 0.5, notes: 'C5:1 r:2 G4:0.5' });
  assert.deepEqual(JSON.parse(JSON.stringify(notes.map(n => [n.freq, n.at, n.length]))), [[523.25, 0, 0.5], [392, 1.5, 0.25]]);
  assert.throws(() => parseTune({ name: 't', unit: 0.5, notes: 'H5:1' }), /unknown note H5/);
  assert.throws(() => parseTune({ name: 't', unit: 0.5, notes: 'C5:x' }), /bad length/);
});

test('the tune is random, but never the same one twice in a row', () => {
  const seen = new Set();
  let previous = null;
  for (let i = 0; i < 300; i++) {
    const tune = pickChristmasTune();
    assert.notEqual(tune.name, previous);
    previous = tune.name;
    seen.add(tune.name);
  }
  assert.equal(seen.size, TUNES.length, 'every tune comes up');
});
