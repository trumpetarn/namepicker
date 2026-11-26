import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from './load-scripts.js';

// A stand-in for the DOM elements slot.js touches.
function fakeElement() {
  const el = {
    style: {},
    children: [],
    classList: { add(c) { el.classes.add(c); }, contains: c => el.classes.has(c) },
    classes: new Set(),
    addEventListener() {},
    appendChild(child) { el.children.push(child); },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: v => { html = v; el.children = []; },
  });
  return el;
}

// Runs one slot spin to the end with a fake clock, recording the reel's offset each frame.
function spin(names, winnerIdx, random) {
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  let now = 0;
  const offsets = [];
  const math = Object.create(Math);
  math.random = () => random;
  const ctx = loadScripts(['js/draws/slot.js'], {
    Math: math,
    document: { getElementById: byId, createElement: fakeElement },
    performance: { now: () => now },
    requestAnimationFrame: cb => {
      now += 16;
      cb(now);
    },
    playTick() {},
    setTimeout() {},
    clearTimeout() {},
  });
  const reel = byId('reel');
  // Record every transform the spin sets.
  let transform = '';
  Object.defineProperty(reel.style, 'transform', {
    get: () => transform,
    set: v => { transform = v; offsets.push(parseFloat(v.match(/-?[\d.]+/)[0])); },
  });
  let done = false;
  ctx.spinSlot(names, winnerIdx, () => { done = true; });
  assert.ok(done, 'spin should finish');
  return {
    ctx,
    offsets,
    reelPos: vm.runInContext('reelPos', ctx),
    winnerShown: reel.children[vm.runInContext('REEL_PAD', ctx)],
  };
}

const names = ['Anna', 'Bo', 'Cecilia', 'David', 'Elin'];

for (const [label, random] of [['goes long and falls back', 0.1], ['stops short and clicks on', 0.9]]) {
  test(`the reel lands on the winner when it ${label}`, () => {
    for (let winner = 0; winner < names.length; winner++) {
      const { reelPos, winnerShown } = spin(names, winner, random);
      assert.equal(reelPos, winner);
      assert.equal(winnerShown.textContent, names[winner]);
      assert.ok(winnerShown.classes.has('win'));
    }
  });
}

test('only the "goes long" ending passes the winner', () => {
  // The spin's last offset is where the winner sits; lower offsets are further along.
  const long = spin(names, 2, 0.1).offsets;
  const short = spin(names, 2, 0.9).offsets;
  // The final transform is the idle reel; the one before is the winner at the end of the spin.
  const endLong = long[long.length - 2];
  const endShort = short[short.length - 2];
  assert.ok(Math.min(...long.slice(0, -1)) < endLong - 10, 'goes past the winner');
  assert.ok(Math.min(...short.slice(0, -1)) >= endShort - 0.01, 'never passes the winner');
  // And it stood still, short of the winner, before clicking on.
  const stopped = short.filter((y, i) => i > 0 && y === short[i - 1] && y > endShort + 30);
  assert.ok(stopped.length > 3, 'hesitates before the last name');
});
