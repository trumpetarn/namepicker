// Färglägen: Mörkt and Ljust are the site theme (data-theme on <html>, localStorage
// site-theme, also set from the site menu's Tema). Clown and Jul are the namepicker's
// own, as data-clown or data-christmas on top of it (at most one of them). The inline
// scripts in <head> have applied them before render; this wires up the switcher and
// gives the canvases (wheel, remote) the current colours, which live as CSS variables
// in namepicker.css. snow.js watches data-christmas by itself.

// The namepicker's own modes: the button's data-theme, its <html> data attribute and
// its localStorage key.
const OWN_THEMES = {
  clown: { attr: 'clown', key: 'namepicker-clown' },
  christmas: { attr: 'christmas', key: 'namepicker-christmas' },
};
const themeButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('#theme-switch button'));
// Read by the canvas code; refreshed whenever the theme changes.
const themeColors = { bg: '', fg: '', surface: '', border: '', muted: '', faint: '', dim: '', font: '' };

function currentTheme() {
  const root = document.documentElement;
  for (const [name, { attr }] of Object.entries(OWN_THEMES)) if (attr in root.dataset) return name;
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

function readThemeColors() {
  const css = getComputedStyle(document.documentElement);
  for (const key of Object.keys(themeColors)) themeColors[key] = css.getPropertyValue('--' + key).trim();
}

function showTheme() {
  const t = currentTheme();
  themeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === t)));
  readThemeColors();
}

// In December Jul is the default (the <head> script turns it on). So then picking Jul
// saves nothing, and it ends with December; picking anything else saves 'off-<year>',
// which keeps Jul off for the rest of this December but not the next.
function decemberYear() {
  const now = new Date();
  return now.getMonth() === 11 ? now.getFullYear() : null;
}

// Turns on one of the namepicker's own modes (or none, with null) and saves it.
function setOwnTheme(name) {
  const december = decemberYear();
  for (const [own, { attr, key }] of Object.entries(OWN_THEMES)) {
    const on = own === name;
    if (on) document.documentElement.dataset[attr] = '';
    else delete document.documentElement.dataset[attr];
    try {
      if (own === 'christmas' && december) {
        if (on) localStorage.removeItem(key);
        else localStorage.setItem(key, 'off-' + december);
      } else if (on) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch {}
  }
}

// Mörkt and Ljust are saved as the site theme, like the site menu does.
function setTheme(t) {
  if (t in OWN_THEMES) return setOwnTheme(t);
  setOwnTheme(null);
  try { localStorage.setItem('site-theme', t); } catch {}
  dispatchEvent(new Event('site-theme'));
}

themeButtons.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
// Picking Auto, Mörkt or Ljust in the site menu leaves Clown and Jul.
addEventListener('site-theme', () => setOwnTheme(null));
// Whatever changed the theme (the switcher, the site menu, the system's setting on
// Auto, another tab), show it and redraw the canvases.
new MutationObserver(() => {
  showTheme();
  refreshStage();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-clown', 'data-christmas'] });
showTheme();
// Clown mode may fall back to the Comic Neue web font; redraw the canvases once it has loaded.
document.fonts?.addEventListener('loadingdone', () => refreshStage());
