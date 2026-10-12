// Mode switching, the draw itself, the name list, and page setup. Loaded last.

let spinning = false;

const MODE_KEY = 'namepicker-mode';
const MODES = ['wheel', 'hat', 'slot'];
const MODE_NAMES = { wheel: 'Lyckohjulet', hat: 'Hatten', slot: 'Enarmade banditen' };
const PICK_LABELS = { wheel: 'Snurra hjulet', hat: 'Dra en lapp', slot: 'Dra i spaken' };
let mode = MODES.includes(localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'wheel';

const pickBtn = /** @type {HTMLButtonElement} */ (document.getElementById('pick-btn'));
const chosen = document.getElementById('chosen');
// Includes the Slumpa button, so it's disabled along with the others during a draw.
const modeBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('#mode-switch button'));

function getNames() {
  return textarea.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
}

function setMode(m) {
  mode = m;
  localStorage.setItem(MODE_KEY, m);
  modeBtns.forEach(b => b.dataset.mode && b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  document.querySelectorAll('.stage-panel').forEach(p => p.classList.toggle('active', p.id === m + '-stage'));
  pickBtn.textContent = PICK_LABELS[m];
  refreshStage();
}

function refreshStage() {
  if (spinning) return;
  const names = getNames();
  if (mode === 'wheel') drawWheel(names);
  else if (mode === 'slot') showIdleReel(names);
}

// The button, the wheel, the hat and the lever all start a draw.
function updatePickEnabled() {
  const disabled = spinning || getNames().length === 0;
  pickBtn.disabled = disabled;
  lever.disabled = disabled;
  document.querySelector('main').classList.toggle('can-pick', !disabled);
}

function setSpinning(on) {
  spinning = on;
  updatePickEnabled();
  modeBtns.forEach(b => b.disabled = on);
  updateGroupControls();
}

// --- Slumpa metod ---

// The highlight runs over the method buttons, slowing down until it stops on a random
// one, which then becomes the selected mode. The draw itself is still started by hand.
function shuffleMode() {
  if (spinning) return;
  const target = MODES[randomInt(MODES.length)];
  const btns = MODES.map(m => document.querySelector(`#mode-switch button[data-mode="${m}"]`));
  const stage = document.getElementById('stage');
  const start = Math.floor(Math.random() * MODES.length);
  // At least two full laps, ending on the target.
  const steps = MODES.length * 2 + ((MODES.indexOf(target) - start + MODES.length) % MODES.length) + 1;

  setSpinning(true);
  stage.classList.add('shuffling');
  pickBtn.textContent = 'Slumpar metod…';

  function step(k) {
    btns.forEach((b, i) => b.classList.toggle('shuffle-hit', i === (start + k) % MODES.length));
    playTick(k === steps - 1 ? 1000 : 1400);
    if (k < steps - 1) {
      setTimeout(() => step(k + 1), 60 + 340 * Math.pow(k / steps, 3));
      return;
    }
    // Flash the chosen method, then switch to it.
    btns[MODES.indexOf(target)].classList.add('shuffle-done');
    setTimeout(() => {
      btns.forEach(b => b.classList.remove('shuffle-hit', 'shuffle-done'));
      stage.classList.remove('shuffling');
      setSpinning(false);
      setMode(target);
    }, 700);
  }
  step(0);
}

// --- Dragning ---

function land(winner, usedMode) {
  chosen.textContent = winner;
  chosen.className = 'landing visible';
  setSpinning(false);
  addToHistory(winner, usedMode);
  showSpotlight(winner);
  launchConfetti();
  playFanfare();
}

// velocity: optional flick speed from dragging the wheel.
function pickName(velocity) {
  if (spinning) return;
  const names = getNames();
  if (names.length === 0) return;

  const winnerIdx = randomInt(names.length);
  const winner = names[winnerIdx];
  const usedMode = mode;
  const done = () => land(winner, usedMode);

  hideSpotlight();
  setSpinning(true);
  chosen.className = '';

  if (mode === 'wheel') spinWheel(names, winnerIdx, done, velocity);
  else if (mode === 'hat') drawFromHat(names, winner, done);
  else {
    swingLever();
    spinSlot(names, winnerIdx, done);
  }
}

// Click (or Enter/Space) on the wheel or the hat instead of the button.
for (const el of [document.getElementById('wheel'), document.getElementById('hat')]) {
  el.addEventListener('click', () => {
    // A finished wheel drag already handled itself; ignore the click that follows it.
    if (performance.now() < wheelIgnoreClickUntil) return;
    pickName();
  });
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    pickName();
  });
}

const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('names'));

function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight) + 'px';
}

const NAMES_HIDDEN_KEY = 'namepicker-names-hidden';
const toggleNamesBtn = document.getElementById('toggle-names');

function namesHidden() {
  return document.querySelector('main').classList.contains('names-hidden');
}

function updateToggleLabel() {
  toggleNamesBtn.textContent = namesHidden() ? `Visa namn (${getNames().length})` : 'Dölj namn';
  toggleNamesBtn.setAttribute('aria-expanded', String(!namesHidden()));
}

function setNamesHidden(hidden) {
  document.querySelector('main').classList.toggle('names-hidden', hidden);
  localStorage.setItem(NAMES_HIDDEN_KEY, hidden ? '1' : '0');
  // The textarea can't be measured while hidden, so size it when it reappears.
  if (!hidden) autoResize();
  updateToggleLabel();
  refreshStage();
}

textarea.addEventListener('input', () => {
  activeGroup().names = textarea.value;
  saveGroups();
  autoResize();
  updatePickEnabled();
  refreshStage();
});

toggleNamesBtn.addEventListener('click', () => setNamesHidden(!namesHidden()));

document.getElementById('rename-group').addEventListener('click', renameGroup);
document.getElementById('delete-group').addEventListener('click', deleteGroup);
document.getElementById('share-group').addEventListener('click', shareGroup);
document.getElementById('export-history').addEventListener('click', exportHistory);
window.addEventListener('hashchange', () => {
  if (spinning) return;
  importFromHash();
  showActiveGroup();
});

modeBtns.forEach(b => b.addEventListener('click', () => b.dataset.mode ? setMode(b.dataset.mode) : shuffleMode()));
window.addEventListener('resize', () => { if (!spinning) refreshStage(); });

importFromHash();
setMode(mode);
showActiveGroup();
setNamesHidden(localStorage.getItem(NAMES_HIDDEN_KEY) === '1');
