// Julklappen (only in Jul): a wrapped present shakes, the lid with its bow pops off, and
// a gift tag with the winner's name rises out. Like Hatten, the winner is chosen first.

// Put the lid back on and the tag back inside without animating.
function resetGift() {
  const gift = document.getElementById('gift');
  const tag = document.getElementById('gift-tag');
  for (const el of [gift, tag]) el.style.transition = 'none';
  gift.classList.remove('shaking', 'open');
  tag.className = '';
  tag.querySelector('span').textContent = '';
  void tag.offsetWidth;
  for (const el of [gift, tag]) el.style.transition = '';
}

function openGift(names, winner, onDone) {
  const gift = document.getElementById('gift');
  const tag = document.getElementById('gift-tag');

  resetGift();
  tag.querySelector('span').textContent = winner;

  void gift.getBoundingClientRect();
  gift.classList.add('shaking');
  // Something rattling inside
  for (let i = 0; i < 6; i++) setTimeout(() => playTick(300 + Math.random() * 250), i * 220 + 100);

  setTimeout(() => {
    gift.classList.remove('shaking');
    gift.classList.add('open');
    playTick(1800); // the lid pops
  }, 1500);
  setTimeout(() => tag.classList.add('risen'), 1800);
  setTimeout(() => tag.classList.add('open'), 2700);
  setTimeout(onDone, 3200);
}
