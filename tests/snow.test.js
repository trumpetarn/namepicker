import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

// snow.js without a page: no #snow-canvas, so it only defines its functions.
const { makeFlakes, stepFlakes } = loadScripts(['js/snow.js'], {
  Math,
  document: { getElementById: () => null },
});

test('the number of flakes follows the window size, up to a maximum', () => {
  assert.equal(makeFlakes(360, 640).length, 26);
  assert.equal(makeFlakes(3840, 2160).length, 160);
  assert.equal(makeFlakes(0, 0).length, 0);
});

test('flakes keep falling inside the window: out at the bottom, back in at the top', () => {
  const [w, h] = [400, 300];
  const flakes = makeFlakes(w, h);
  let wrapped = false;
  for (let frame = 0; frame < 2000; frame++) {
    const before = flakes.map(f => f.y);
    stepFlakes(flakes, w, h);
    flakes.forEach((f, i) => {
      if (f.y < before[i]) wrapped = true;
      assert.ok(f.y >= -f.r && f.y <= h + f.r + f.speed * 3, `y ${f.y}`);
      assert.ok(f.x >= -f.r - 1 && f.x <= w + f.r + 1, `x ${f.x}`);
    });
  }
  assert.ok(wrapped, 'a flake came back at the top');
});

test('a longer frame moves a flake further, so the speed doesn\'t depend on the frame rate', () => {
  const [a] = makeFlakes(400, 300);
  const b = { ...a };
  a.y = b.y = 10;
  stepFlakes([a], 400, 300, 1);
  stepFlakes([b], 400, 300, 2);
  assert.ok(Math.abs((b.y - 10) - 2 * (a.y - 10)) < 1e-9);
});
