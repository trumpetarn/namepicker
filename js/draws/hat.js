// Hatten: draw a note from the hat.

// Snap the previous note back into the hat without animating.
function resetHat() {
  const note = document.getElementById('hat-note');
  note.style.transition = 'none';
  note.className = '';
  note.querySelector('span').textContent = '';
  void note.offsetWidth;
  note.style.transition = '';
  document.getElementById('hat').classList.remove('shaking');
  document.getElementById('hat-slips').innerHTML = '';
}

function drawFromHat(names, winner, onDone) {
  const hat = document.getElementById('hat');
  const note = document.getElementById('hat-note');
  const slips = document.getElementById('hat-slips');

  resetHat();
  note.querySelector('span').textContent = winner;

  hat.classList.remove('shaking');
  void hat.getBoundingClientRect();
  hat.classList.add('shaking');

  slips.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const slip = document.createElement('div');
    slip.className = 'hat-slip';
    slip.textContent = names[Math.floor(Math.random() * names.length)];
    slip.style.setProperty('--dx', `${(Math.random() - 0.5) * 50}px`);
    slip.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
    slip.style.setProperty('--delay', `${i * 0.2}s`);
    slips.appendChild(slip);
    setTimeout(() => playTick(600 + Math.random() * 300), i * 200 + 350);
  }

  setTimeout(() => {
    hat.classList.remove('shaking');
    slips.innerHTML = '';
    note.classList.add('risen');
  }, 1600);
  setTimeout(() => note.classList.add('open'), 2700);
  setTimeout(onDone, 3200);
}
