import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from './load-scripts.js';

// The remote's spin runs on requestAnimationFrame; drive it with a fake clock so
// a whole spin finishes instantly. The canvas reports zero width, so nothing is drawn.
function loadRemote() {
  let now = 0;
  let ticks = 0;
  // remoteRot as each animation frame is requested. The fake requestAnimationFrame runs
  // the next frame from inside the current one, so record before calling back.
  const frames = [];
  const canvas = { clientWidth: 0, addEventListener() {} };
  const ctx = loadScripts(['js/draws/wheel.js', 'js/draws/remote.js'], {
    document: { getElementById: () => canvas },
    performance: { now: () => now },
    requestAnimationFrame: cb => {
      frames.push(vm.runInContext('remoteRot', ctx));
      now += 16;
      cb(now);
    },
    playTick: () => { ticks++; },
  });
  return { ctx, ticks: () => ticks, frames };
}

function spin(ctx, names, winnerIdx, velocity) {
  let finished = false;
  ctx.spinRemote(names, winnerIdx, () => { finished = true; }, velocity);
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


test('a flicked spin turns the way it was flicked and still stops on the winner', () => {
  for (const velocity of [0.005, 0.03, -0.005, -0.03]) {
    const { ctx, frames } = loadRemote();
    const names = Array.from({ length: 9 }, (_, i) => `Namn ${i}`);
    for (let round = 0; round < 10; round++) {
      const winner = (round * 4 + 1) % names.length;
      const start = vm.runInContext('remoteRot', ctx);
      frames.length = 0;
      assert.equal(spin(ctx, names, winner, velocity), winner, `velocity ${velocity}, round ${round}`);
      // The last recorded value is from just before the final wrap into one turn.
      const turned = frames[frames.length - 1] - start;
      assert.ok(Math.sign(turned) === Math.sign(velocity), `velocity ${velocity} turned ${turned}`);
      assert.ok(Math.abs(turned) > Math.PI * 2, 'more than one full turn');
    }
  }
});
