// Jul: the tunes the fanfare picks from (playChristmasFanfare in effects.js). All are
// public domain and in C major, so they share the closing chord.
//
// A tune is a line of notes, each `pitch:length` with the length in `unit`s of seconds;
// `r` is a rest. Pitches go from C4 to G5, with `Bb` for B flat. To add a tune, add a
// line; tests/tunes.test.js checks that it parses and isn't longer than 7 s. A tune may
// go on a little after the spotlight fades (4 s).

const CHRISTMAS_TUNES = [
  {
    name: 'Jingle Bells', // James Lord Pierpont, 1857: "jingle bells, jingle bells, jingle all the way"
    unit: 0.17,
    notes: 'E5:1 E5:1 E5:2 E5:1 E5:1 E5:2 E5:1 G5:1 C5:1.5 D5:0.5 E5:4',
  },
  {
    name: 'We Wish You a Merry Christmas', // English, traditional: the first line, then "and a happy New Year"
    unit: 0.12,
    notes: 'G4:2 C5:2 C5:1 D5:1 C5:1 B4:1 A4:2 A4:2 G4:1 G4:1 A4:2 D5:2 B4:2 C5:6',
  },
  {
    name: 'Deck the Halls', // Welsh, traditional: "deck the halls with boughs of holly, fa-la-la-la-la, la-la-la-la"
    unit: 0.09,
    notes: 'G5:3 F5:1 E5:2 D5:2 C5:2 D5:2 E5:2 C5:2 D5:1 E5:1 F5:1 D5:1 E5:3 D5:1 C5:2 B4:2 C5:4',
  },
  {
    // Swedish folk tune: "nu är det jul igen och nu är det jul igen och julen varar fram till
    // påska", at about 140 quarter notes a minute. The usual key is G major; moved up a fourth
    // to C like the others.
    name: 'Nu är det jul igen',
    unit: 0.214,
    notes: 'C5:1 C5:0.5 C5:0.5 C5:1 G4:1 E4:1 G4:1 C5:1 C5:0.5 C5:0.5 C5:1 G4:1 E4:1 G4:1 ' +
      'C5:1.5 B4:0.5 C5:1 D5:1 E5:1 F5:1 G5:2 G5:4',
  },
];

const NOTE_FREQUENCIES = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

// [{ freq, at, length }] in seconds, rests left out; throws on a note it doesn't know.
function parseTune(tune) {
  const notes = [];
  let at = 0;
  for (const token of tune.notes.trim().split(/\s+/)) {
    const [pitch, beats] = token.split(':');
    const length = Number(beats) * tune.unit;
    if (!(length > 0)) throw new Error(`${tune.name}: bad length in ${token}`);
    if (pitch !== 'r') {
      if (!(pitch in NOTE_FREQUENCIES)) throw new Error(`${tune.name}: unknown note ${pitch}`);
      notes.push({ freq: NOTE_FREQUENCIES[pitch], at, length });
    }
    at += length;
  }
  return notes;
}

// A random tune, never the same one twice in a row. Only decides the sound, so
// Math.random is fine.
let lastTuneIndex = -1;

function pickChristmasTune(random = Math.random) {
  const choices = CHRISTMAS_TUNES.map((_, i) => i).filter(i => i !== lastTuneIndex || CHRISTMAS_TUNES.length === 1);
  lastTuneIndex = choices[Math.floor(random() * choices.length)];
  return CHRISTMAS_TUNES[lastTuneIndex];
}
