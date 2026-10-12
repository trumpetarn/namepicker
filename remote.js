// Fjärrkontrollen: the names stand still in a ring and a TV remote spins in the middle,
// stopping with its tip pointing at the winner. Uses TAU, WHEEL_COLORS and fitText from wheel.js.

const remoteCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('remote'));
let remoteRot = 0; // radians, clockwise from pointing straight up

// Index of the name the remote's tip is closest to.
function remoteTarget(rot, count) {
  const seg = TAU / count;
  return ((Math.round(rot / seg) % count) + count) % count;
}

function drawRemote(names) {
  const canvas = remoteCanvas;
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
  const dotR = c * 0.56;    // ring of markers the remote points at
  const textIn = c * 0.62;  // names run from here out to the edge
  const textOut = c - 6;

  if (names.length === 0) {
    ctx.beginPath();
    ctx.arc(c, c, dotR, 0, TAU);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawRemoteBody(ctx, c, remoteRot);
    ctx.fillStyle = '#555';
    ctx.font = '300 1rem system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lägg till namn', c, c + c * 0.82);
    return;
  }

  const seg = TAU / names.length;
  const current = remoteTarget(remoteRot, names.length);
  // Scales with the stage, shrinking so neighbouring names don't overlap.
  const fontSize = Math.max(9, Math.min(c * 0.085, seg * textIn * 0.75));

  // The "beam" from the remote's tip to the marker it points at.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(remoteRot);
  ctx.beginPath();
  ctx.moveTo(0, -c * 0.46);
  ctx.lineTo(0, -dotR);
  ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.restore();

  names.forEach((name, i) => {
    const hit = i === current;
    // Name i sits at i × seg clockwise from the top; in canvas angles 0 is to the right.
    const phi = i * seg - Math.PI / 2;

    ctx.beginPath();
    ctx.arc(c + Math.cos(phi) * dotR, c + Math.sin(phi) * dotR, hit ? 5 : 3, 0, TAU);
    ctx.fillStyle = hit ? WHEEL_COLORS[i % WHEEL_COLORS.length] : '#444';
    ctx.fill();

    ctx.save();
    ctx.translate(c, c);
    ctx.font = `${hit ? 500 : 300} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = hit ? '#fff' : '#999';
    ctx.textBaseline = 'middle';
    const text = fitText(ctx, name, textOut - textIn);
    // Read outwards on the right half; flip on the left half so no name is upside down.
    if (Math.cos(phi) >= -1e-9) {
      ctx.rotate(phi);
      ctx.textAlign = 'left';
      ctx.fillText(text, textIn, 0);
    } else {
      ctx.rotate(phi + Math.PI);
      ctx.textAlign = 'right';
      ctx.fillText(text, -textIn, 0);
    }
    ctx.restore();
  });

  drawRemoteBody(ctx, c, remoteRot);
}

// A TV remote centred on (c, c), its tip (with the IR LED) pointing along angle.
function drawRemoteBody(ctx, c, angle) {
  const w = c * 0.22;
  const top = -c * 0.46;
  const bottom = c * 0.38;

  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(angle);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.roundRect(-w / 2, top, w, bottom - top, w * 0.3);
  ctx.fillStyle = '#2b2b2b';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();

  // IR LED at the tip.
  ctx.beginPath();
  ctx.arc(0, top + w * 0.16, w * 0.09, 0, TAU);
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Power button.
  ctx.beginPath();
  ctx.arc(0, top + w * 0.55, w * 0.14, 0, TAU);
  ctx.fillStyle = '#d64545';
  ctx.fill();

  // Arrow pad.
  ctx.beginPath();
  ctx.arc(0, top + w * 1.35, w * 0.32, 0, TAU);
  ctx.fillStyle = '#3d3d3d';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, top + w * 1.35, w * 0.12, 0, TAU);
  ctx.fillStyle = '#5a5a5a';
  ctx.fill();

  // Number keys.
  const key = w * 0.18;
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      ctx.beginPath();
      ctx.roundRect(col * w * 0.28 - key / 2, top + w * 2.0 + row * w * 0.3, key, key * 0.7, key * 0.2);
      ctx.fillStyle = '#4a4a4a';
      ctx.fill();
    }
  }

  ctx.restore();
}

// velocity: optional flick speed in rad/ms (negative = anticlockwise) from dragging the
// remote. Like the wheel's flick, it sets the direction, turns and starting speed, but
// the winner is still chosen up front and steered to.
function spinRemote(names, winnerIdx, onDone, velocity) {
  const seg = TAU / names.length;
  // Point somewhere around the winner's marker, never closer to a neighbour.
  const jitter = (Math.random() - 0.5) * seg * 0.6;
  const desired = winnerIdx * seg + jitter;
  const startRot = remoteRot;
  const dir = velocity < 0 ? -1 : 1;
  const delta = ((((desired - startRot) * dir) % TAU) + TAU) % TAU;
  let turns = 4 + Math.floor(Math.random() * 3);
  let duration = 6000 + Math.random() * 1500;
  if (velocity) {
    const speed = Math.abs(velocity);
    turns = Math.min(8, Math.max(2, Math.round(1 + speed * 200)));
    // The cubic ease-out starts at 3 × distance / duration; match the flick where we can.
    duration = Math.min(9000, Math.max(3500, 3 * (delta + TAU * turns) / speed));
  }
  const target = startRot + dir * (delta + TAU * turns);
  const t0 = performance.now();
  let lastTarget = remoteTarget(startRot, names.length);

  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    remoteRot = startRot + (target - startRot) * (1 - Math.pow(1 - p, 3));
    const pointed = remoteTarget(remoteRot, names.length);
    if (pointed !== lastTarget) {
      lastTarget = pointed;
      playTick();
    }
    drawRemote(names);
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      remoteRot %= TAU;
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

addSpinDrag(remoteCanvas, {
  getRot: () => remoteRot,
  setRot: r => { remoteRot = r; },
  tickIndex: remoteTarget,
  draw: drawRemote,
});
