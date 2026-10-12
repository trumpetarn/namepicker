// Lyckohjulet: canvas spinning wheel.

const WHEEL_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#e040fb', '#00bcd4', '#f06292'];
const TAU = Math.PI * 2;
let wheelRot = 0;

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function drawWheel(names) {
  const canvas = wheelCanvas;
  const size = canvas.clientWidth;
  if (!size) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = canvas.height = Math.round(size * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const c = size / 2;
  const r = c - 4;

  if (names.length === 0) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.font = '300 1rem system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lägg till namn', c, c);
    return;
  }

  const seg = TAU / names.length;
  // Scales with the wheel (larger when the name list is hidden), shrinking to fit thin slices.
  const fontSize = Math.max(11, Math.min(r * 0.15, seg * r * 0.5));

  names.forEach((name, i) => {
    // Slice 0 starts at the pointer (top) and slices run clockwise.
    const start = wheelRot + i * seg - Math.PI / 2;
    let color = WHEEL_COLORS[i % WHEEL_COLORS.length];
    // Avoid the last slice sharing a colour with its neighbour, slice 0.
    if (i > 0 && i === names.length - 1 && i % WHEEL_COLORS.length === 0) color = WHEEL_COLORS[2];

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, start, start + seg);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = names.length > 40 ? 0.5 : 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + seg / 2);
    ctx.fillStyle = '#111';
    ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, name, r * 0.78), r - 12, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(c, c, r * 0.12, 0, TAU);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// velocity: optional flick speed in rad/ms (negative = anticlockwise) from dragging the
// wheel. It sets the direction, the number of turns and the starting speed, but the
// winner is still chosen up front and steered to, so a careful flick can't pick it.
function spinWheel(names, winnerIdx, onDone, velocity) {
  const seg = TAU / names.length;
  // Rotation that puts the winner's slice under the pointer, landing somewhere inside the slice.
  const jitter = (Math.random() - 0.5) * seg * 0.7;
  const desired = -(winnerIdx + 0.5) * seg + jitter;
  const startRot = wheelRot;
  const dir = velocity < 0 ? -1 : 1;
  const delta = ((((desired - startRot) * dir) % TAU) + TAU) % TAU;
  let turns = 5 + Math.floor(Math.random() * 2);
  let duration = 8000 + Math.random() * 1500;
  if (velocity) {
    const speed = Math.abs(velocity);
    turns = Math.min(10, Math.max(3, Math.round(2 + speed * 250)));
    // The cubic ease-out starts at 3 × distance / duration; match the flick where we can.
    duration = Math.min(10000, Math.max(4000, 3 * (delta + TAU * turns) / speed));
  }
  const target = startRot + dir * (delta + TAU * turns);
  const t0 = performance.now();
  let lastSlice = Math.floor(startRot / seg);

  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    wheelRot = startRot + (target - startRot) * (1 - Math.pow(1 - p, 3));
    const slice = Math.floor(wheelRot / seg);
    if (slice !== lastSlice) {
      lastSlice = slice;
      playTick();
    }
    drawWheel(names);
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      wheelRot %= TAU;
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// --- Dra i hjulet ---

const wheelCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wheel'));
const WHEEL_DRAG_MIN = 6;         // px of pointer travel before a press counts as a drag
const WHEEL_FLICK_MIN = 0.004;    // rad/ms needed on release to start a spin
const WHEEL_FLICK_WINDOW = 100;   // ms of recent movement used to measure the flick
let wheelDrag = null;
let wheelIgnoreClickUntil = 0;

function wheelAngle(e) {
  const rect = wheelCanvas.getBoundingClientRect();
  return Math.atan2(e.clientY - rect.top - rect.height / 2, e.clientX - rect.left - rect.width / 2);
}

wheelCanvas.addEventListener('pointerdown', e => {
  if (spinning || e.button !== 0 || getNames().length === 0) return;
  wheelCanvas.setPointerCapture(e.pointerId);
  const angle = wheelAngle(e);
  wheelDrag = {
    startX: e.clientX, startY: e.clientY, moved: false,
    angle, lastSlice: null, samples: [{ rot: wheelRot, t: e.timeStamp }],
  };
});

wheelCanvas.addEventListener('pointermove', e => {
  if (!wheelDrag || spinning) return;
  if (!wheelDrag.moved && Math.hypot(e.clientX - wheelDrag.startX, e.clientY - wheelDrag.startY) < WHEEL_DRAG_MIN) return;
  wheelDrag.moved = true;
  wheelCanvas.classList.add('dragging');
  const angle = wheelAngle(e);
  // Unwrap across the ±π seam so the wheel follows the pointer smoothly.
  let d = angle - wheelDrag.angle;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  wheelDrag.angle = angle;
  wheelRot += d;

  const names = getNames();
  const slice = Math.floor(wheelRot / (TAU / names.length));
  if (wheelDrag.lastSlice !== null && slice !== wheelDrag.lastSlice) playTick();
  wheelDrag.lastSlice = slice;
  wheelDrag.samples.push({ rot: wheelRot, t: e.timeStamp });
  while (wheelDrag.samples.length > 2 && e.timeStamp - wheelDrag.samples[0].t > WHEEL_FLICK_WINDOW) wheelDrag.samples.shift();
  drawWheel(names);
});

function endWheelDrag(e) {
  if (!wheelDrag) return;
  const { moved, samples } = wheelDrag;
  wheelDrag = null;
  wheelCanvas.classList.remove('dragging');
  // A plain click (or tap) falls through to the click handler.
  if (!moved) return;
  wheelIgnoreClickUntil = performance.now() + 500;
  const first = samples[0];
  const last = samples[samples.length - 1];
  // Holding still before letting go means no flick.
  const dt = e.timeStamp - first.t;
  const velocity = dt > 0 && e.timeStamp - last.t < WHEEL_FLICK_WINDOW ? (last.rot - first.rot) / dt : 0;
  if (e.type === 'pointerup' && Math.abs(velocity) >= WHEEL_FLICK_MIN) pickName(velocity);
  else wheelRot %= TAU;
}

wheelCanvas.addEventListener('pointerup', endWheelDrag);
wheelCanvas.addEventListener('pointercancel', endWheelDrag);
