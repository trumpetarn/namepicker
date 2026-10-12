import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from './load-scripts.js';

// The remote's spin runs on requestAnimationFrame; drive it with a fake clock so
// a whole spin finishes instantly. The canvas reports zero width, so nothing is drawn.
function loadRemote() {
  let now = 0;
  let ticks = 0;
  const canvas = { clientWidth: 0, addEventListener() {} };
  const ctx = loadScripts(['namepicker/wheel.js', 'namepicker/remote.js'], {
    document: { getElementById: () => canvas },
    performance: { now: () => now },
    requestAnimationFrame: cb => { now += 16; cb(now); },
    playTick: () => { ticks++; },
  });
  return { ctx, ticks: () => ticks };
}

function spin(ctx, names, winnerIdx) {
  let finished = false;
  ctx.spinRemote(names, winnerIdx, () => { finished = true; });
  assert.ok(finished, 'spin should finish');
  // remoteRot is a top-level let, not a property of the global object.
  return ctx.remoteTarget(vm.runInContext('remoteRot', ctx), names.length);
}

test('remoteTarget picks the nearest name clockwise from the top', () => {
  const { ctx } = loadRemote();
  const seg = (Math.PI * 2) / 4;
  assert.equal(ctx.remoteTarget(0, 4), 0);
  assert.equal(ctx.remoteTarget(seg * 0.49, 4), 0);
  assert.equal(ctx.remoteTarget(seg * 0.51, 4), 1);
  assert.equal(ctx.remoteTarget(seg * 3, 4), 3);
  assert.equal(ctx.remoteTarget(-seg, 4), 3);
  assert.equal(ctx.remoteTarget(Math.PI * 2 * 5 + seg * 2, 4), 2);
});

test('the remote always stops pointing at the chosen winner', () => {
  for (const count of [1, 2, 3, 7, 12, 40]) {
    const { ctx } = loadRemote();
    const names = Array.from({ length: count }, (_, i) => `Namn ${i}`);
    // Several spins in a row, so each starts from where the last one stopped.
    for (let round = 0; round < 25; round++) {
      const winner = (round * 7 + 3) % count;
      assert.equal(spin(ctx, names, winner), winner, `${count} names, round ${round}`);
    }
  }
});

test('a spin ticks as the remote passes the names', () => {
  const { ctx, ticks } = loadRemote();
  spin(ctx, ['A', 'B', 'C', 'D', 'E'], 2);
  // At least four full turns past five names.
  assert.ok(ticks() >= 20, `only ${ticks()} ticks`);
});
