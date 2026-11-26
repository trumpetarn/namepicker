import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadScripts } from './load-scripts.js';

// The site deploys this whole folder to /namepicker/ except what .deployignore
// lists, so every top-level entry must be one or the other.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ignored = readFileSync(ROOT + '.deployignore', 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => l.replace(/\/$/, ''));

const html = readFileSync(ROOT + 'index.html', 'utf8');
const BASE = 'https://jakobmarkgren.se/namepicker/';
const { assetUrls } = loadScripts(['sw.js'], {
  URL,
  self: { location: { href: BASE + 'sw.js' }, addEventListener() {} },
});
const used = new Set(['index.html', 'sw.js']);
for (const [, ref] of html.matchAll(/\b(?:href|src)="([^"?#:/][^"?#:]*)"/g)) used.add(ref.split('/')[0]);
for (const url of assetUrls('', BASE)) used.add(url.slice(BASE.length).split('/')[0]);
// Absolute links to this folder in <meta>, e.g. og:image
for (const [, url] of html.matchAll(/content="https:\/\/jakobmarkgren\.se\/namepicker\/([^"?#]+)"/g)) used.add(url.split('/')[0]);

test('every top-level file is either used by the page or in .deployignore', () => {
  for (const name of readdirSync(ROOT)) {
    assert.ok(used.has(name) || ignored.includes(name),
      `${name} isn't used by index.html or sw.js: add it to .deployignore if it isn't part of the page`);
  }
});

test('nothing in .deployignore is used by the page', () => {
  for (const name of ignored) assert.ok(!used.has(name), `${name} is used by the page but listed in .deployignore`);
});
