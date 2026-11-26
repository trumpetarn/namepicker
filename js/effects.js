// Confetti, the winner spotlight and Web Audio sound effects (ticks and the winner fanfare).

function launchConfetti() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('confetti-canvas'));
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Jul: the wheel's red, green, gold and snow instead
  const colors = currentTheme() === 'christmas' ? [...CHRISTMAS_COLORS, '#ffffff']
    : ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f1c', '#e040fb', '#00bcd4', '#ffffff'];
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
  fitSpotlightName();
  spotlightTimer = setTimeout(hideSpotlight, SPOTLIGHT_MS);
}

// Shrink the name until its longest word fits on the screen, so words wrap between each
// other instead of being split mid-word (CSS splits them only below the minimum size).
function fitSpotlightName() {
  const nameEl = document.getElementById('spotlight-name');
  nameEl.style.fontSize = '';
  nameEl.style.overflowWrap = 'normal';
  let size = parseFloat(getComputedStyle(nameEl).fontSize);
  while (nameEl.scrollWidth > nameEl.clientWidth && size > 24) {
    size -= 2;
    nameEl.style.fontSize = size + 'px';
  }
  nameEl.style.overflowWrap = '';
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

  function note(freq, startOffset, duration, vol = 0.28, type = 'triangle', bendTo = freq) {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = type;
    const t = actx.currentTime + startOffset;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(bendTo, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Jul: Jingle Bells instead (see playChristmasFanfare)
  if (currentTheme() === 'christmas') return playChristmasFanfare(actx);

  // Ascending arpeggio C5–E5–G5, then triumphant chord C5+E5+G5+C6
  note(523.25, 0,    0.13);          // C5
  note(659.25, 0.12, 0.13);          // E5
  note(783.99, 0.24, 0.13);          // G5
  note(523.25, 0.36, 0.55, 0.18);   // C5 chord
  note(659.25, 0.36, 0.55, 0.18);   // E5 chord
  note(783.99, 0.36, 0.55, 0.18);   // G5 chord
  note(1046.50, 0.36, 0.55, 0.18);  // C6 chord

  // Clownläge: tut-tut på en cykeltuta efter fanfaren.
  if (currentTheme() === 'clown') {
    note(420, 1.0, 0.16, 0.12, 'sawtooth', 300);
    note(420, 1.22, 0.24, 0.12, 'sawtooth', 280);
  }
}

// Jul: the start of Jingle Bells' chorus ("jingle bells, jingle bells, jingle all the
// way", a public-domain tune from 1857) on a glockenspiel-like bell, over a soft
// C major chord at the end, with sleigh bells shaken on every beat.
function playChristmasFanfare(actx) {
  // A struck bell: the note plus a quieter overtone, both dying away quickly.
  function bell(freq, start, duration, vol = 0.22) {
    for (const [mult, v] of [[1, vol], [2.76, vol * 0.25]]) {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const t = actx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(v, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }
  }

  // Sleigh bells: a short burst of high pings.
  function jingle(start) {
    for (let i = 0; i < 4; i++) {
      bell(2600 + Math.random() * 1400, start + i * 0.018, 0.12, 0.025);
    }
  }

  const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99;
  const beat = 0.17;
  // [note, start in beats, length in beats]
  const tune = [
    [E5, 0, 1], [E5, 1, 1], [E5, 2, 2],
    [E5, 4, 1], [E5, 5, 1], [E5, 6, 2],
    [E5, 8, 1], [G5, 9, 1], [C5, 10, 1.5], [D5, 11.5, 0.5], [E5, 12, 4],
  ];
  for (const [freq, at, length] of tune) bell(freq, at * beat, Math.max(length * beat * 1.6, 0.3));
  // A soft chord under the last note
  for (const freq of [C5 / 2, G5 / 2, C5]) bell(freq, 12 * beat, 1.2, 0.08);
  for (let b = 0; b <= 12; b += 2) jingle(b * beat);
}
