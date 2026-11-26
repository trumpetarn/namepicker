// The active group's pick history and its CSV export.

// The history has no cap; the list shows the newest ones until "Visa alla" is clicked.
const HISTORY_SHOWN = 25;
let historyShowAll = false;
// The list can be collapsed to just its heading; one setting for all groups.
const HISTORY_HIDDEN_KEY = 'namepicker-history-hidden';

function formatHistDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The method's display name: one of ours, or the free text of an imported entry.
function entryMethod(entry) {
  return MODE_NAMES[entry.mode] || entry.method || '';
}

// Excluded entries (a test spin, a redraw, a mistake) stay in the list but don't count:
// not in the CSV export, and not in statistics.
function includedEntries(history) {
  return history.filter(entry => !entry.excluded);
}

function histSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function renderHistory() {
  const history = activeGroup().history;
  const section = document.getElementById('history');
  const list = document.getElementById('history-list');
  const more = document.getElementById('history-more');
  if (history.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'flex';
  const hidden = localStorage.getItem(HISTORY_HIDDEN_KEY) === '1';
  const toggle = document.getElementById('toggle-history');
  toggle.textContent = hidden ? `Historik (${history.length})` : 'Historik';
  toggle.setAttribute('aria-expanded', String(!hidden));
  // The list or the statistics (stats.js), under the same heading
  const statsBtn = document.getElementById('toggle-stats');
  statsBtn.setAttribute('aria-pressed', String(statsShown));
  document.getElementById('history-stats').hidden = hidden || !statsShown;
  if (!hidden && statsShown) renderStats();
  list.hidden = hidden || statsShown;
  const shown = historyShowAll ? history : history.slice(0, HISTORY_SHOWN);
  more.hidden = list.hidden || history.length <= HISTORY_SHOWN;
  more.textContent = historyShowAll ? 'Visa färre' : `Visa alla ${history.length}`;
  // Built with textContent: names can come from someone else's share link or file.
  list.replaceChildren(...shown.map((entry, i) => {
    const li = document.createElement('li');
    li.classList.toggle('excluded', !!entry.excluded);
    li.append(histSpan('rank', i + 1), histSpan('hist-name', entry.name));
    if (entryMethod(entry)) li.append(histSpan('hist-mode', entryMethod(entry)));
    if (entry.date) li.append(histSpan('hist-date', formatHistDate(entry.date)));
    li.append(excludeButton(entry));
    return li;
  }));
}

function excludeButton(entry) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hist-exclude';
  btn.disabled = spinning;
  btn.textContent = entry.excluded ? '↺' : '×';
  const what = [entry.name, formatHistDate(entry.date)].filter(Boolean).join(', ');
  btn.title = entry.excluded ? 'Räkna med igen' : 'Uteslut (räknas inte)';
  btn.setAttribute('aria-label', entry.excluded ? `Räkna med ${what} igen` : `Uteslut ${what}`);
  btn.setAttribute('aria-pressed', String(!!entry.excluded));
  btn.addEventListener('click', () => setExcluded(entry, !entry.excluded));
  return btn;
}

function setExcluded(entry, excluded) {
  if (spinning) return;
  if (excluded) entry.excluded = true;
  else delete entry.excluded;
  saveGroups();
  renderHistory();
}

function toggleHistory() {
  const hidden = localStorage.getItem(HISTORY_HIDDEN_KEY) === '1';
  localStorage.setItem(HISTORY_HIDDEN_KEY, hidden ? '0' : '1');
  renderHistory();
}

function toggleHistoryShowAll() {
  historyShowAll = !historyShowAll;
  renderHistory();
}

// Semicolon-separated with a UTF-8 BOM so Swedish Excel opens it with columns and åäö intact.
function csvCell(value) {
  let text = String(value);
  // Stop spreadsheet apps from treating a name as a formula (names can come from share links).
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function historyCsv(group) {
  const rows = [['Grupp', 'Namn', 'Metod', 'Datum', 'Tid']];
  for (const entry of includedEntries(group.history)) {
    const d = entry.date ? new Date(entry.date) : null;
    rows.push([
      group.name,
      entry.name,
      entryMethod(entry),
      d ? d.toLocaleDateString('sv-SE') : '',
      d ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '',
    ]);
  }
  return '\ufeff' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

// namnvaljare-<group>-<today>.<ext>
function exportFileName(group, ext) {
  const slug = group.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'grupp';
  return `namnvaljare-${slug}-${new Date().toLocaleDateString('sv-SE')}.${ext}`;
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportHistory() {
  const group = activeGroup();
  downloadFile(exportFileName(group, 'csv'), historyCsv(group), 'text/csv;charset=utf-8');
}

// A new draw this soon after the previous one is taken as a redraw (a test spin, or the
// wrong person), so the previous pick stops counting.
const REDRAW_MS = 60 * 1000;

// Marks the newest entry excluded if it was picked less than REDRAW_MS before now.
// Returns that entry, or null.
function excludeIfRedraw(history, now = new Date()) {
  const last = history[0];
  if (!last || last.excluded || !last.date) return null;
  const age = now.getTime() - Date.parse(last.date);
  if (!(age >= 0 && age < REDRAW_MS)) return null;
  last.excluded = true;
  return last;
}

// mode: which randomizer made the pick (missing on entries saved before it was recorded).
// Returns the new entry.
function addToHistory(name, mode) {
  const group = activeGroup();
  const now = new Date();
  excludeIfRedraw(group.history, now);
  const entry = { name, mode, date: now.toISOString() };
  group.history.unshift(entry);
  saveGroups();
  renderHistory();
  return entry;
}

// "Ångra" under the result for a short while after a draw: excludes that pick, for a test
// spin or the wrong person. Hidden by the next draw or a group switch.
const UNDO_MS = 10000;
let undoTimer = 0;

function offerUndo(entry) {
  const btn = document.getElementById('undo-pick');
  clearTimeout(undoTimer);
  btn.hidden = false;
  btn.onclick = () => {
    setExcluded(entry, true);
    chosen.classList.add('excluded');
    hideUndo();
  };
  undoTimer = setTimeout(hideUndo, UNDO_MS);
}

function hideUndo() {
  clearTimeout(undoTimer);
  document.getElementById('undo-pick').hidden = true;
}
