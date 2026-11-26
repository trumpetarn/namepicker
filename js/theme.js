// Färglägen: Mörkt and Ljust are the site theme (data-theme on <html>, localStorage
// site-theme, also set from the site menu's Tema); Clown is the namepicker's own, as
// data-clown on top of it. The inline scripts in <head> have applied both before render;
// this wires up the switcher and gives the canvases (wheel, remote) the current colours,
// which live as CSS variables in namepicker.css.

const CLOWN_KEY = 'namepicker-clown';
const themeButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('#theme-switch button'));
// Read by the canvas code; refreshed whenever the theme changes.
const themeColors = { bg: '', fg: '', surface: '', border: '', muted: '', faint: '', dim: '', font: '' };

function currentTheme() {
  const root = document.documentElement;
  if ('clown' in root.dataset) return 'clown';
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

function setClown(on) {
  if (on) document.documentElement.dataset.clown = '';
  else delete document.documentElement.dataset.clown;
  try {
    if (on) localStorage.setItem(CLOWN_KEY, '1');
    else localStorage.removeItem(CLOWN_KEY);
  } catch {}
}

// Mörkt and Ljust are saved as the site theme, like the site menu does.
function setTheme(t) {
  setClown(t === 'clown');
  if (t === 'clown') return;
  try { localStorage.setItem('site-theme', t); } catch {}
  dispatchEvent(new Event('site-theme'));
}

themeButtons.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
// Picking Auto, Mörkt or Ljust in the site menu leaves clown mode.
addEventListener('site-theme', () => setClown(false));
// Whatever changed the theme (the switcher, the site menu, the system's setting on
// Auto, another tab), show it and redraw the canvases.
new MutationObserver(() => {
  showTheme();
  refreshStage();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-clown'] });
showTheme();
// Clown mode may fall back to the Comic Neue web font; redraw the canvases once it has loaded.
document.fonts?.addEventListener('loadingdone', () => refreshStage());
