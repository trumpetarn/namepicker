// Lyckohjulet: canvas spinning wheel.

const WHEEL_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#e040fb', '#00bcd4', '#f06292'];
// Jul: red, green, gold and snow, all light enough for the dark names drawn on them.
const CHRISTMAS_COLORS = ['#ef5350', '#66bb6a', '#f4c542', '#eceff1', '#ff8a80', '#a5d6a7', '#ffd54f', '#b3e5fc'];

// The slice colours for the current colour mode (currentTheme is in theme.js).
function sliceColors() {
  return currentTheme() === 'christmas' ? CHRISTMAS_COLORS : WHEEL_COLORS;
}
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
  // Jul: the slices shrink to make room for a wreath around them
  const wreath = currentTheme() === 'christmas';
  const r = wreath ? c * 0.86 : c - 4;
  if (wreath) drawWreath(ctx, c, r);

  if (names.length === 0) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fillStyle = themeColors.surface;
    ctx.fill();
    ctx.strokeStyle = themeColors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = themeColors.faint;
    ctx.font = `300 16px ${themeColors.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lägg till namn', c, c);
    return;
  }

  const seg = TAU / names.length;
  const colors = sliceColors();
  // Scales with the wheel (larger when the name list is hidden), shrinking to fit thin slices.
  const fontSize = Math.max(11, Math.min(r * 0.15, seg * r * 0.5));

  names.forEach((name, i) => {
    // Slice 0 starts at the pointer (top) and slices run clockwise.
    const start = wheelRot + i * seg - Math.PI / 2;
    let color = colors[i % colors.length];
    // Avoid the last slice sharing a colour with its neighbour, slice 0.
    if (i > 0 && i === names.length - 1 && i % colors.length === 0) color = colors[2];

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, start, start + seg);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = themeColors.bg;
    ctx.lineWidth = names.length > 40 ? 0.5 : 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + seg / 2);
    ctx.fillStyle = '#111'; // dark text on the bright slices in every theme
    ctx.font = `500 ${fontSize}px ${themeColors.font}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, name, r * 0.78), r - 12, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(c, c, r * 0.12, 0, TAU);
  ctx.fillStyle = themeColors.bg;
  ctx.fill();
  ctx.strokeStyle = themeColors.fg;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Jul: a fir wreath from r to the canvas edge, with clusters of red berries and a red bow
// at the bottom (the star at the top is the pointer, in CSS). It doesn't turn with the
// wheel, and it's drawn the same every time (no Math.random), so redraws don't flicker.
function drawWreath(ctx, c, r) {
  const outer = c - 2;
  const mid = (r + outer) / 2;
  const width = outer - r;

  // A dark core, narrower than the band, for the spikes to grow out of
  ctx.beginPath();
  ctx.arc(c, c, mid, 0, TAU);
  ctx.strokeStyle = '#174d1b';
  ctx.lineWidth = width * 0.55;
  ctx.stroke();

  // Needles: sharp spikes in three greens, leaning along the ring, some reaching out
  // past the band and some in over the slices' edge, in two layers so it looks bushy.
  // (i * 7) % 10 etc. vary them without Math.random, so every redraw is the same.
  const needles = 110;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < needles; i++) {
      const a = ((i + layer * 0.5) / needles) * TAU;
      const out = (i + layer) % 2 === 0;                    // spikes out or in
      const base = mid + (out ? 0.05 : -0.05) * width;
      const len = width * (0.55 + ((i * 7) % 10) / 22);      // 0.55–0.96 of the band
      const tip = base + (out ? 0.6 : -0.75) * len; // outward ones stop at the canvas edge
      const lean = (len / mid) * (layer ? -0.55 : 0.55);     // along the ring
      const half = (width * 0.09) / mid;                    // half the spike's base, as an angle
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a - half) * base, c + Math.sin(a - half) * base);
      ctx.lineTo(c + Math.cos(a + lean) * tip, c + Math.sin(a + lean) * tip);
      ctx.lineTo(c + Math.cos(a + half) * base, c + Math.sin(a + half) * base);
      ctx.closePath();
      ctx.fillStyle = ['#2e7d32', '#388e3c', '#43a047', '#1b5e20'][(i + layer) % 4];
      ctx.fill();
    }
  }

  // Berries: three together, every 45°, but not under the bow
  const berry = Math.max(2, width * 0.16);
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k + 0.5) * (TAU / 8);
    if (Math.abs(Math.sin(a) - 1) < 0.2) continue; // the bottom, where the bow sits
    for (const [da, dr] of [[-0.04, -0.15], [0.04, -0.15], [0, 0.18]]) {
      ctx.beginPath();
      ctx.arc(c + Math.cos(a + da) * (mid + dr * width), c + Math.sin(a + da) * (mid + dr * width), berry, 0, TAU);
      ctx.fillStyle = '#d32f2f';
      ctx.fill();
    }
  }

  // The bow at the bottom: two loops, two tails and a knot
  const bx = c, by = c + mid, s = width * 1.15;
  ctx.fillStyle = '#c62828';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx + side * s * 1.6, by - s * 1.1, bx + side * s * 1.9, by + s * 0.6, bx, by);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + side * s * 0.9, by + s * 1.3);
    ctx.lineTo(bx + side * s * 0.45, by + s * 1.15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(bx, by, s * 0.32, 0, TAU);
  ctx.fillStyle = '#a31f1f';
  ctx.fill();
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
