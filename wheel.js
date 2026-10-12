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

// --- Dra för att snurra (hjulet och fjärrkontrollen) ---

const wheelCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('wheel'));
const SPIN_DRAG_MIN = 6;         // px of pointer travel before a press counts as a drag
const SPIN_FLICK_MIN = 0.004;    // rad/ms needed on release to start a spin
const SPIN_FLICK_WINDOW = 100;   // ms of recent movement used to measure the flick
// A finished drag is followed by a click event; app.js ignores clicks until this time.
let dragIgnoreClickUntil = 0;

// Lets the pointer turn a canvas's rotation by dragging around its centre, ticking as it
// passes names, and starts a draw (pickName with the flick's velocity) when let go fast
// enough. rot is in radians, clockwise; getRot/setRot read and write it, tickIndex says
// which name a rotation is at (for the ticks), and draw redraws the canvas.
function addSpinDrag(canvas, { getRot, setRot, tickIndex, draw }) {
  let drag = null;

  function angleOf(e) {
    const rect = canvas.getBoundingClientRect();
    return Math.atan2(e.clientY - rect.top - rect.height / 2, e.clientX - rect.left - rect.width / 2);
  }

  canvas.addEventListener('pointerdown', e => {
    if (spinning || e.button !== 0 || getNames().length === 0) return;
    canvas.setPointerCapture(e.pointerId);
    drag = {
      startX: e.clientX, startY: e.clientY, moved: false,
      angle: angleOf(e), lastTick: null, samples: [{ rot: getRot(), t: e.timeStamp }],
    };
  });

  canvas.addEventListener('pointermove', e => {
    if (!drag || spinning) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < SPIN_DRAG_MIN) return;
    drag.moved = true;
    canvas.classList.add('dragging');
    const angle = angleOf(e);
    // Unwrap across the ±π seam so the rotation follows the pointer smoothly.
    let d = angle - drag.angle;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    drag.angle = angle;
    const rot = getRot() + d;
    setRot(rot);

    const names = getNames();
    const tick = tickIndex(rot, names.length);
    if (drag.lastTick !== null && tick !== drag.lastTick) playTick();
    drag.lastTick = tick;
    drag.samples.push({ rot, t: e.timeStamp });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > SPIN_FLICK_WINDOW) drag.samples.shift();
    draw(names);
  });

  function endDrag(e) {
    if (!drag) return;
    const { moved, samples } = drag;
    drag = null;
    canvas.classList.remove('dragging');
    // A plain click (or tap) falls through to the click handler.
    if (!moved) return;
    dragIgnoreClickUntil = performance.now() + 500;
    const first = samples[0];
    const last = samples[samples.length - 1];
    // Holding still before letting go means no flick.
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 && e.timeStamp - last.t < SPIN_FLICK_WINDOW ? (last.rot - first.rot) / dt : 0;
    if (e.type === 'pointerup' && Math.abs(velocity) >= SPIN_FLICK_MIN) pickName(velocity);
    else setRot(getRot() % TAU);
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

addSpinDrag(wheelCanvas, {
  getRot: () => wheelRot,
  setRot: r => { wheelRot = r; },
  tickIndex: (rot, count) => Math.floor(rot / (TAU / count)),
  draw: drawWheel,
});
