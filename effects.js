// Confetti, the winner spotlight and Web Audio sound effects (ticks and the winner fanfare).

function launchConfetti() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('confetti-canvas'));
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#e040fb', '#00bcd4', '#ffffff'];
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height * 0.6,
    w: Math.random() * 10 + 5,
    h: Math.random() * 5 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rot += p.rotSpeed;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(animate);
}

let audioCtx = null;

// The winner's name, big and centred over a dimmed page while the confetti falls.
// It fades by itself, or on a click or key press. The name also stays in #result.
const SPOTLIGHT_MS = 4000;
let spotlightTimer = null;

function showSpotlight(name) {
  const el = document.getElementById('spotlight');
  document.getElementById('spotlight-name').textContent = name;
  clearTimeout(spotlightTimer);
  el.classList.remove('leaving');
  el.hidden = false;
  spotlightTimer = setTimeout(hideSpotlight, SPOTLIGHT_MS);
}

function hideSpotlight() {
  const el = document.getElementById('spotlight');
  clearTimeout(spotlightTimer);
  if (el.hidden || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  spotlightTimer = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('leaving');
  }, 300);
}

document.getElementById('spotlight').addEventListener('click', hideSpotlight);
document.addEventListener('keydown', () => {
  if (!document.getElementById('spotlight').hidden) hideSpotlight();
});

function getAudio() {
  const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTick(freq = 1400) {
  const actx = getAudio();
  if (!actx) return;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);
  osc.type = 'square';
  osc.frequency.value = freq;
  const t = actx.currentTime;
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.start(t);
  osc.stop(t + 0.05);
}

function playFanfare() {
  const actx = getAudio();
  if (!actx) return;

  function note(freq, startOffset, duration, vol = 0.28) {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = actx.currentTime + startOffset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Ascending arpeggio C5–E5–G5, then triumphant chord C5+E5+G5+C6
  note(523.25, 0,    0.13);          // C5
  note(659.25, 0.12, 0.13);          // E5
  note(783.99, 0.24, 0.13);          // G5
  note(523.25, 0.36, 0.55, 0.18);   // C5 chord
  note(659.25, 0.36, 0.55, 0.18);   // E5 chord
  note(783.99, 0.36, 0.55, 0.18);   // G5 chord
  note(1046.50, 0.36, 0.55, 0.18);  // C6 chord
}
