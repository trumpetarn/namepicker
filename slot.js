// Enarmade banditen: looping reel and its draggable lever.

// The reel is the name list in order, looping forever. The window shows the centred
// name plus one full and one half row on each side, so the list visibly continues.
const ROW_H = 56;
const REEL_CENTER_Y = 84;
const REEL_PAD = 2;
const reel = document.getElementById('reel');
let reelPos = 0;

function reelName(names, i) {
  const n = names.length;
  return names[((i % n) + n) % n];
}

function buildReel(names, from, count) {
  reel.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'reel-item';
    item.textContent = names.length ? reelName(names, from + i) : '';
    reel.appendChild(item);
  }
}

// translateY that puts strip row k in the centre frame.
function reelOffset(k) {
  return REEL_CENTER_Y - k * ROW_H;
}

function showIdleReel(names) {
  if (names.length) reelPos %= names.length;
  buildReel(names, reelPos - REEL_PAD, REEL_PAD * 2 + 1);
  reel.style.transform = `translateY(${reelOffset(REEL_PAD)}px)`;
}

function spinSlot(names, winnerIdx, onDone) {
  const n = names.length;
  // Always travel forward through the list, at least ~30 rows, ending on the winner.
  const distance = ((winnerIdx - reelPos) % n + n) % n + n * Math.max(2, Math.ceil(30 / n));
  buildReel(names, reelPos - REEL_PAD, distance + REEL_PAD * 2 + 1);

  const startY = reelOffset(REEL_PAD);
  const endY = reelOffset(REEL_PAD + distance);
  // Two endings, picked at random (only the animation; the winner is already decided):
  // the reel creeps a little past the winner towards the next name and falls back, or it
  // slows to a stop while the previous name is still in the frame, hesitates, and then
  // clicks on to the winner.
  const goesLong = Math.random() < 0.5;
  const stopY = goesLong ? endY - ROW_H * 0.35 : endY + ROW_H * 0.6;
  const runTime = 6500;
  const settleTime = goesLong ? 350 : 650;
  const hesitate = goesLong ? 0 : 0.35; // share of the settle spent standing still
  const t0 = performance.now();
  let lastY = startY;
  let lastRow = REEL_PAD;

  function frame(now) {
    const t = now - t0;
    let y;
    if (t < runTime) {
      const p = t / runTime;
      y = startY + (stopY - startY) * (1 - Math.pow(1 - p, 3));
    } else {
      const p = Math.max(0, (Math.min(1, (t - runTime) / settleTime) - hesitate) / (1 - hesitate));
      y = stopY + (endY - stopY) * (0.5 - Math.cos(Math.PI * p) / 2);
    }
    reel.style.transform = `translateY(${y}px)`;
    reel.style.filter = `blur(${Math.min(4, Math.abs(y - lastY) / 12)}px)`;
    lastY = y;
    const row = Math.round((REEL_CENTER_Y - y) / ROW_H);
    if (row !== lastRow) {
      lastRow = row;
      playTick();
    }
    if (t < runTime + settleTime) {
      requestAnimationFrame(frame);
    } else {
      reel.style.filter = '';
      reelPos = winnerIdx;
      showIdleReel(names);
      reel.children[REEL_PAD].classList.add('win');
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// --- Spaken ---

const lever = /** @type {HTMLButtonElement} */ (document.getElementById('lever'));
const leverArm = document.getElementById('lever-arm');
const leverKnob = document.getElementById('lever-knob');
const LEVER_TRAVEL = 184;  // knob travel from top to bottom, through the pivot
const LEVER_TRIGGER = 0.6; // how far a drag must pull before it counts
let leverDrag = null;
let leverSwingTimer = null;
let leverIgnoreClickUntil = 0;

// p: 0 = resting up, 1 = pulled all the way down.
function setLeverPull(p, transition = 'none') {
  leverArm.style.transition = leverKnob.style.transition = transition;
  leverArm.style.transform = `scaleY(${1 - 2 * p})`;
  leverKnob.style.transform = `translateY(${p * LEVER_TRAVEL}px)`;
}

// Slam the lever down, then let it spring back up.
function swingLever() {
  clearTimeout(leverSwingTimer);
  setLeverPull(1, 'transform 0.15s ease-in');
  leverSwingTimer = setTimeout(() => setLeverPull(0, 'transform 0.7s cubic-bezier(0.3, 1.6, 0.5, 1)'), 150);
}

lever.addEventListener('pointerdown', e => {
  if (lever.disabled || e.button !== 0) return;
  lever.setPointerCapture(e.pointerId);
  leverDrag = { startY: e.clientY, pull: 0, moved: false };
});

lever.addEventListener('pointermove', e => {
  if (!leverDrag) return;
  const dy = e.clientY - leverDrag.startY;
  if (Math.abs(dy) > 4) leverDrag.moved = true;
  if (!leverDrag.moved) return;
  leverDrag.pull = Math.min(1, Math.max(0, dy / LEVER_TRAVEL));
  setLeverPull(leverDrag.pull);
});

function endLeverDrag() {
  if (!leverDrag) return;
  const { moved, pull } = leverDrag;
  leverDrag = null;
  // A plain click (or tap) falls through to the click handler.
  if (!moved) return;
  leverIgnoreClickUntil = performance.now() + 500;
  if (pull >= LEVER_TRIGGER) pickName();
  else setLeverPull(0, 'transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1)');
}

lever.addEventListener('pointerup', endLeverDrag);
lever.addEventListener('pointercancel', endLeverDrag);

lever.addEventListener('click', () => {
  // A finished drag already handled itself; ignore the click that follows it.
  if (performance.now() < leverIgnoreClickUntil) return;
  pickName();
});
