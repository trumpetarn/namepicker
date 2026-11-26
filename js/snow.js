// Jul: snow falling behind the page while data-christmas is set on <html>. Watches the
// attribute itself, so it doesn't depend on theme.js or on the order the scripts load.
// Purely visual, so Math.random is fine. With prefers-reduced-motion the flakes stand still.

const SNOW_MAX_FLAKES = 160;
const SNOW_AREA_PER_FLAKE = 9000; // px² of window per flake, so a phone gets fewer

/** @typedef {{ x: number, y: number, r: number, speed: number, drift: number, phase: number }} Flake */

/** @returns {Flake} */
function makeFlake(width, height) {
  const r = 1 + Math.random() * 2.5;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r,
    speed: 0.3 + r * 0.25,           // bigger flakes are nearer, so they fall faster
    drift: 0.3 + Math.random() * 0.7, // how far it sways sideways
    phase: Math.random() * Math.PI * 2,
  };
}

function makeFlakes(width, height) {
  const count = Math.min(SNOW_MAX_FLAKES, Math.round((width * height) / SNOW_AREA_PER_FLAKE));
  return Array.from({ length: count }, () => makeFlake(width, height));
}

// Moves every flake one frame (dt in 60 fps frames). One that falls out at the bottom
// comes back at the top; one that sways out at a side comes in at the other.
function stepFlakes(flakes, width, height, dt = 1) {
  for (const f of flakes) {
    f.phase += 0.01 * dt;
    f.y += f.speed * dt;
    f.x += Math.sin(f.phase) * f.drift * dt;
    if (f.y - f.r > height) {
      Object.assign(f, makeFlake(width, height));
      f.y = -f.r; // just above the top, out of sight
    }
    if (f.x < -f.r) f.x += width + 2 * f.r;
    else if (f.x > width + f.r) f.x -= width + 2 * f.r;
  }
}

(() => {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('snow-canvas'));
  if (!canvas) return; // the tests load this file without a page
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let flakes = [];
  let frame = 0;
  let last = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    flakes = makeFlakes(innerWidth, innerHeight);
  }

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const f of flakes) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick(now) {
    // At most 3 frames at once, so a background tab doesn't make the snow jump
    const dt = last ? Math.min((now - last) / (1000 / 60), 3) : 1;
    last = now;
    stepFlakes(flakes, innerWidth, innerHeight, dt);
    draw();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function update() {
    const on = 'christmas' in document.documentElement.dataset;
    canvas.hidden = !on;
    stop();
    if (!on) return;
    if (!flakes.length) resize();
    if (still.matches) draw();
    else frame = requestAnimationFrame(tick);
  }

  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-christmas'] });
  still.addEventListener('change', update);
  addEventListener('resize', () => {
    if (canvas.hidden) return;
    resize();
    if (still.matches) draw();
  });
  update();
})();
