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
  list.hidden = hidden;
  const shown = historyShowAll ? history : history.slice(0, HISTORY_SHOWN);
  more.hidden = hidden || history.length <= HISTORY_SHOWN;
  more.textContent = historyShowAll ? 'Visa färre' : `Visa alla ${history.length}`;
  // Built with textContent: names can come from someone else's share link or file.
  list.replaceChildren(...shown.map((entry, i) => {
    const li = document.createElement('li');
    li.append(histSpan('rank', i + 1), histSpan('hist-name', entry.name));
    if (entryMethod(entry)) li.append(histSpan('hist-mode', entryMethod(entry)));
    if (entry.date) li.append(histSpan('hist-date', formatHistDate(entry.date)));
    return li;
  }));
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
  for (const entry of group.history) {
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

// mode: which randomizer made the pick (missing on entries saved before it was recorded).
function addToHistory(name, mode) {
  const group = activeGroup();
  group.history.unshift({ name, mode, date: new Date().toISOString() });
  saveGroups();
  renderHistory();
}
