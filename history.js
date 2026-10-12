// The active group's pick history and its CSV export.

const MAX_HISTORY = 25;

function formatHistDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
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
  if (history.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'flex';
  // Built with textContent: names can come from someone else's share link.
  list.replaceChildren(...history.map((entry, i) => {
    const li = document.createElement('li');
    li.append(histSpan('rank', i + 1), histSpan('hist-name', entry.name));
    if (MODE_NAMES[entry.mode]) li.append(histSpan('hist-mode', MODE_NAMES[entry.mode]));
    if (entry.date) li.append(histSpan('hist-date', formatHistDate(entry.date)));
    return li;
  }));
}

// Semicolon-separated with a UTF-8 BOM so Swedish Excel opens it with columns and åäö intact.
function csvCell(value) {
  let text = String(value);
  // Stop spreadsheet apps from treating a name as a formula (names can come from share links).
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportHistory() {
  const group = activeGroup();
  const rows = [['Grupp', 'Namn', 'Metod', 'Datum', 'Tid']];
  for (const entry of group.history) {
    const d = entry.date ? new Date(entry.date) : null;
    rows.push([
      group.name,
      entry.name,
      MODE_NAMES[entry.mode] || '',
      d ? d.toLocaleDateString('sv-SE') : '',
      d ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '',
    ]);
  }
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `namnvaljare-${group.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'grupp'}-${new Date().toLocaleDateString('sv-SE')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// mode: which randomizer made the pick (missing on entries saved before it was recorded).
function addToHistory(name, mode) {
  const group = activeGroup();
  group.history.unshift({ name, mode, date: new Date().toISOString() });
  group.history = group.history.slice(0, MAX_HISTORY);
  saveGroups();
  renderHistory();
}
