import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadScripts, fakeLocalStorage } from './load-scripts.js';

// index.html carries the site theme block that every page of jakobmarkgren.se
// inlines (the site's repo checks that the copies are identical). namepicker.css
// must agree with it, so the page and the site menu look the same as elsewhere.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(ROOT + 'index.html', 'utf8');
const css = readFileSync(ROOT + 'namepicker.css', 'utf8');

const BLOCK = /\/\* Site theme: [^\n]*\n\s*:root \{[\s\S]*?\n\s*\}\s*\/\* Ljust[^\n]*\n\s*:root\[data-theme="light"\] \{[\s\S]*?\n\s*\}/;
const LIGHT = /:root\[data-theme="light"\] \{[\s\S]*?\}/;
const variables = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

test("namepicker.css's Mörkt and Ljust match the site theme", () => {
  const block = html.match(BLOCK)?.[0];
  assert.ok(block, 'index.html: the site theme block is missing');
  const site = variables(block.replace(LIGHT, ''));
  const siteLight = variables(block.match(LIGHT)[0]);
  const themes = {
    default: variables(css.match(/^:root \{[\s\S]*?^\}/m)[0]),
    light: variables(css.match(/^:root\[data-theme="light"\] \{[\s\S]*?^\}/m)[0]),
    clown: variables(css.match(/^:root\[data-clown\] \{[\s\S]*?^\}/m)[0]),
    christmas: variables(css.match(/^:root\[data-christmas\] \{[\s\S]*?^\}/m)[0]),
  };
  for (const [name, value] of Object.entries(site)) {
    assert.equal(themes.default[name], value, `namepicker.css :root --${name}`);
    if (siteLight[name]) assert.equal(themes.light[name], siteLight[name], `namepicker.css light --${name}`);
    // Every theme sets every site variable, so the site menu fits each colour mode
    if (name !== 'font') {
      assert.ok(themes.light[name], `namepicker.css light theme is missing --${name}`);
      assert.ok(themes.clown[name], `namepicker.css clown theme is missing --${name}`);
      assert.ok(themes.christmas[name], `namepicker.css christmas theme is missing --${name}`);
    }
  }
});

// Clown and Jul: theme.js's OWN_THEMES, each with a button, a colour block and a line in
// the <head> script that applies it before the page renders.
test('each of the namepicker\'s own colour modes is wired up everywhere', () => {
  const themeJs = readFileSync(ROOT + 'js/theme.js', 'utf8');
  const own = [...themeJs.matchAll(/^ {2}(\w+): \{ attr: '([\w-]+)', key: '([\w-]+)' \},$/gm)]
    .map(([, name, attr, key]) => ({ name, attr, key }));
  assert.deepEqual(own.map(t => t.name), ['clown', 'christmas']);
  const head = html.slice(0, html.indexOf('</head>'));
  for (const { name, attr, key } of own) {
    assert.match(html, new RegExp(`<button type="button" data-theme="${name}">`), `no ${name} button`);
    assert.match(css, new RegExp(`^:root\\[data-${attr}\\] \\{`, 'm'), `no :root[data-${attr}] block`);
    assert.ok(head.includes(`localStorage.getItem('${key}')`) && head.includes(`dataset.${attr} = ''`),
      `the <head> script doesn't apply ${name}`);
  }
});

// Jul is the default in December. Date with a fixed "now" (local time) for the scripts.
function fakeDate(year, month, day) {
  const now = new Date(year, month - 1, day, 12).getTime();
  return class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  };
}

// The <head> script that applies Clown or Jul before render; returns the modes it set.
const headScript = html.match(/<script>\s*\/\/ Clown or Jul[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
function applied(items, [year, month, day]) {
  const root = { dataset: {} };
  vm.runInNewContext(headScript, { localStorage: fakeLocalStorage(items), Date: fakeDate(year, month, day), document: { documentElement: root } });
  return Object.keys(root.dataset);
}

test('the <head> script turns Jul on in December, unless another mode was picked this December', () => {
  assert.deepEqual(applied({}, [2026, 11, 30]), []);
  assert.deepEqual(applied({}, [2026, 12, 1]), ['christmas']);
  assert.deepEqual(applied({}, [2026, 12, 31]), ['christmas']);
  assert.deepEqual(applied({}, [2027, 1, 1]), []);
  assert.deepEqual(applied({ 'namepicker-christmas': 'off-2026' }, [2026, 12, 10]), []);
  assert.deepEqual(applied({ 'namepicker-christmas': 'off-2026' }, [2027, 12, 10]), ['christmas'], 'last year\'s choice');
  assert.deepEqual(applied({ 'namepicker-christmas': '1' }, [2027, 3, 1]), ['christmas'], 'picked by hand');
  assert.deepEqual(applied({ 'namepicker-clown': '1' }, [2026, 12, 10]), ['clown'], 'Clown wins');
});

// theme.js's switcher with a stub page; returns setTheme and the storage it writes.
function switcher(date, items = {}) {
  const storage = fakeLocalStorage(items);
  const root = { dataset: {} };
  const ctx = loadScripts(['js/theme.js'], {
    Date: fakeDate(...date),
    localStorage: storage,
    document: { documentElement: root, querySelectorAll: () => [] },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    MutationObserver: class { observe() {} },
    addEventListener() {},
    dispatchEvent() {},
    Event: class {},
  });
  return { setTheme: ctx.setTheme, storage, root };
}

test('picking a mode in December saves Jul as off for this December only, and Jul as nothing', () => {
  const { setTheme, storage, root } = switcher([2026, 12, 5]);
  setTheme('dark');
  assert.equal(storage.getItem('namepicker-christmas'), 'off-2026');
  assert.deepEqual(Object.keys(root.dataset), []);
  setTheme('clown');
  assert.equal(storage.getItem('namepicker-christmas'), 'off-2026');
  assert.equal(storage.getItem('namepicker-clown'), '1');
  setTheme('christmas');
  assert.equal(storage.getItem('namepicker-christmas'), null, 'the December default, so it ends with December');
  assert.equal(storage.getItem('namepicker-clown'), null);
  assert.deepEqual(Object.keys(root.dataset), ['christmas']);
});

test('outside December, Jul is saved when picked and removed when left, like Clown', () => {
  const { setTheme, storage } = switcher([2027, 3, 1], { 'namepicker-christmas': 'off-2026' });
  setTheme('christmas');
  assert.equal(storage.getItem('namepicker-christmas'), '1');
  setTheme('light');
  assert.equal(storage.getItem('namepicker-christmas'), null);
});
