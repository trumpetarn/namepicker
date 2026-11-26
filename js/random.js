// Randomness for the outcome of a draw: the winner and the Slumpa method. Purely visual
// randomness (confetti, spin jitter, hat slips) stays on Math.random.

// Uniform integer in [0, n), from the browser's CSPRNG (seeded by OS entropy). Values in
// the uneven tail of the 32-bit range are redrawn, so every result has exactly equal odds.
function randomInt(n) {
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}
