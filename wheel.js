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
  const canvas = document.getElementById('wheel');
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
  const fontSize = Math.max(10, Math.min(18, seg * r * 0.45));

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
    ctx.fillText(fitText(ctx, name, r * 0.72), r - 12, 0);
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

function spinWheel(names, winnerIdx, onDone) {
  const seg = TAU / names.length;
  // Rotation that puts the winner's slice under the pointer, landing somewhere inside the slice.
  const jitter = (Math.random() - 0.5) * seg * 0.7;
  const desired = -(winnerIdx + 0.5) * seg + jitter;
  const startRot = wheelRot;
  const delta = (((desired - startRot) % TAU) + TAU) % TAU;
  const target = startRot + delta + TAU * (5 + Math.floor(Math.random() * 2));
  const duration = 8000 + Math.random() * 1500;
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
