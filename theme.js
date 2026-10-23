// Färglägen: dark (default), light and clown. The inline script in <head> has already
// put the saved one on <html> as data-theme; this wires up the switcher and gives the
// canvases (wheel, remote) the current colours, which live as CSS variables in namepicker.css.

const THEME_KEY = 'namepicker-theme';
const THEMES = ['dark', 'light', 'clown'];
const themeButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('#theme-switch button'));
// Read by the canvas code; refreshed whenever the theme changes.
const themeColors = { bg: '', fg: '', surface: '', border: '', muted: '', faint: '', dim: '', font: '' };

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return THEMES.includes(t) ? t : 'dark';
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

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  showTheme();
  refreshStage();
}

themeButtons.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
showTheme();
// Clown mode may fall back to the Comic Neue web font; redraw the canvases once it has loaded.
document.fonts?.addEventListener('loadingdone', () => refreshStage());
