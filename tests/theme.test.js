import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    assert.ok(head.includes(`localStorage.getItem('${key}') === '1'`) && head.includes(`dataset.${attr} = ''`),
      `the <head> script doesn't apply ${name}`);
  }
});
