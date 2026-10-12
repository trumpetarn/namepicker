import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

const { encodeShare, decodeShare } = loadScripts(
  ['namepicker/groups.js', 'namepicker/share.js'],
  { localStorage: fakeLocalStorage() },
);

// The decoded objects come from another vm realm, so compare them as JSON.
const plain = value => JSON.parse(JSON.stringify(value));

test('a shared group survives the round trip, including non-ASCII names', () => {
  const group = { name: 'Åsa & Örjan', names: 'Anna\n\n  Bo  \nÄngla 🎉\n' };
  const encoded = encodeShare(group);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/, 'must only use URL-safe base64 characters');
  assert.deepEqual(plain(decodeShare(encoded)), { name: 'Åsa & Örjan', names: ['Anna', 'Bo', 'Ängla 🎉'] });
});

test('decodeShare rejects garbage', () => {
  assert.equal(decodeShare('not base64!'), null);
  assert.equal(decodeShare(btoa('{"broken json')), null);
  assert.equal(decodeShare(btoa(JSON.stringify({ n: 1, l: [] }))), null);
});

test('decodeShare trims and caps what a link can import', () => {
  const longName = 'x'.repeat(200);
  const data = { n: '   ', l: ['  a  ', '', 42, longName, ...Array(600).fill('b')] };
  const encoded = btoa(JSON.stringify(data)).replace(/=+$/, '');
  const shared = decodeShare(encoded);
  assert.equal(shared.name, 'Delad grupp');
  assert.equal(shared.names.length, 500);
  assert.equal(shared.names[0], 'a');
  assert.equal(shared.names[1], 'x'.repeat(100));
});
