import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts } from './load-scripts.js';
import { versionLinks } from '../scripts/version-assets.js';

// The namepicker as an installable app: its manifest, icons and service worker.
const SITE = fileURLToPath(new URL('../jakobmarkgren.se/public_html/', import.meta.url));
const DIR = join(SITE, 'namepicker');
const html = readFileSync(join(DIR, 'index.html'), 'utf8');

const pngSize = path => {
  const png = readFileSync(path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

// sw.js with a stub worker scope: only its top-level functions are used.
const { assetUrls } = loadScripts(['namepicker/sw.js'], {
  URL,
  self: { location: { href: 'https://jakobmarkgren.se/namepicker/sw.js' }, addEventListener() {} },
});
const BASE = 'https://jakobmarkgren.se/namepicker/';

test('the page links the manifest, and the manifest is scoped to the namepicker', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Namnväljare');
  assert.equal(manifest.start_url, '/namepicker/');
  assert.equal(manifest.scope, '/namepicker/');
  assert.equal(manifest.display, 'standalone');
  const sizes = new Set(manifest.icons.map(i => i.sizes));
  assert.ok(sizes.has('192x192') && sizes.has('512x512'), 'needs 192 and 512 px icons');
  for (const icon of manifest.icons) {
    assert.deepEqual(pngSize(join(DIR, icon.src)), icon.sizes.split('x').map(Number), icon.src);
  }
});

test('the apple-touch-icon exists and is 180×180', () => {
  const href = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/)[1];
  assert.deepEqual(pngSize(join(DIR, href)), [180, 180]);
});

test('the worker caches every local CSS/JS link, with the version the deploy gives it', () => {
  const links = [...html.matchAll(/\b(?:href|src)="([^"?#:/][^"?#:]*\.(?:css|js))"/g)].map(m => BASE + m[1]);
  assert.ok(links.length > 10, 'found the page\'s scripts');

  const plain = assetUrls(html, BASE);
  for (const url of links) assert.ok(plain.includes(url), `${url} not cached`);

  const deployed = versionLinks(html, join(DIR, 'index.html'), SITE);
  const versioned = assetUrls(deployed, BASE);
  for (const url of links) {
    assert.ok(versioned.some(u => new RegExp(`^${url.replace(/\./g, '\\.')}\\?v=[0-9a-f]{10}$`).test(u)), `${url}?v= not cached`);
  }
  assert.ok(!versioned.some(u => /\.(css|js)$/.test(u)), 'no unversioned CSS/JS after deploy');
});

test('the worker\'s extra files exist, and it isn\'t registered under another name', () => {
  const extra = assetUrls('', BASE);
  assert.ok(extra.length > 0);
  for (const url of extra) assert.ok(existsSync(join(DIR, url.slice(BASE.length))), `${url} doesn't exist`);
  assert.match(readFileSync(join(DIR, 'app.js'), 'utf8'), /serviceWorker\?\.register\('sw\.js'/);
});
