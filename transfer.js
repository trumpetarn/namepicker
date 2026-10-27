// Files: import history from the page's own CSV export, and export/import a whole group
// as JSON. Files are read locally only, and anything else is rejected rather than guessed at.

// --- Reading the history CSV ---

// Exactly what historyCsv writes (semicolons, UTF-8 with a BOM); other files are rejected.
const CSV_HEADER = ['Grupp', 'Namn', 'Metod', 'Datum', 'Tid'];

function parseCsv(text) {
  text = text.replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === ';') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Undoes the ' that csvCell puts before a value that looks like a formula.
function unguardCell(text) {
  return /^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text;
}

// Datum (YYYY-MM-DD) and Tid (HH:MM) as Swedish local time, to an ISO string. Both empty
// means no date (entries saved before dates were recorded); undefined means invalid.
function csvDate(day, time) {
  if (!day && !time) return null;
  const d = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = time.match(/^(\d{2}):(\d{2})$/);
  if (!d || !t) return undefined;
  const [y, mo, dd, h, mi] = [...d.slice(1), ...t.slice(1)].map(Number);
  const date = new Date(y, mo - 1, dd, h, mi);
  if (h > 23 || mi > 59 || date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== dd) {
    return undefined;
  }
  return date.toISOString();
}

// One of our methods by display name ("Lyckohjulet"); other text is a method that came
// in with an imported group, kept as is.
function modeFromMethod(text) {
  return MODES.find(m => MODE_NAMES[m] === text);
}

// Newest first; entries without a date last, in their original order.
function byDateDesc(a, b) {
  const ta = a.date ? Date.parse(a.date) : -Infinity;
  const tb = b.date ? Date.parse(b.date) : -Infinity;
  return ta === tb ? 0 : tb > ta ? 1 : -1;
}

// Returns the entries, newest first, or throws an Error with a message for the user naming
// the first bad row. The Grupp column is ignored: the history goes into the active group.
function historyFromCsv(text) {
  const rows = parseCsv(text).map(row => row.map(unguardCell));
  if (!rows.length || rows[0].join(';') !== CSV_HEADER.join(';')) {
    throw new Error(`Filen är ingen historikexport från Namnväljaren. Första raden ska vara ${CSV_HEADER.join(';')}.`);
  }
  const entries = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (row.length === 1 && row[0] === '') return; // a blank line
    if (row.length !== CSV_HEADER.length) {
      throw new Error(`Rad ${line} har ${row.length} kolumner i stället för ${CSV_HEADER.length}.`);
    }
    const [, name, method, day, time] = row.map(cell => cell.trim());
    if (!name) throw new Error(`Rad ${line} saknar namn.`);
    const date = csvDate(day, time);
    if (date === undefined) throw new Error(`Rad ${line} har ett ogiltigt datum eller klockslag: "${day} ${time}".`);
    const entry = { name: name.slice(0, 100) };
    const mode = modeFromMethod(method);
    if (mode) entry.mode = mode;
    else if (method) entry.method = method.slice(0, 60);
    entry.date = date;
    entries.push(entry);
  });
  return entries.sort(byDateDesc);
}

// Same name, method and minute: the export has no seconds.
function entryKey(entry) {
  const minute = entry.date ? Math.floor(Date.parse(entry.date) / 60000) : '';
  return [entry.name, entry.mode || entry.method || '', minute].join('\u0000');
}

function mergeHistory(existing, imported) {
  const seen = new Set(existing.map(entryKey));
  const added = imported.filter(e => !seen.has(entryKey(e)));
  return {
    history: [...existing, ...added].sort(byDateDesc),
    added: added.length,
    duplicates: imported.length - added.length,
  };
}

// --- Whole-group files ---

const GROUP_FILE_FORMAT = 'namnvaljare-grupp';
const GROUP_FILE_VERSION = 1;

function groupFile(group) {
  const data = { format: GROUP_FILE_FORMAT, version: GROUP_FILE_VERSION, name: group.name, names: namesFromText(group.names) };
  if (Array.isArray(group.modes)) data.modes = group.modes;
  data.history = group.history;
  return JSON.stringify(data, null, 2) + '\n';
}

function cleanEntry(e) {
  if (!e || typeof e.name !== 'string' || !e.name.trim()) return null;
  const entry = { name: e.name.trim().slice(0, 100) };
  if (MODES.includes(e.mode)) entry.mode = e.mode;
  else if (typeof e.method === 'string' && e.method.trim()) entry.method = e.method.trim().slice(0, 60);
  const t = typeof e.date === 'string' ? Date.parse(e.date) : NaN;
  entry.date = Number.isFinite(t) ? new Date(t).toISOString() : null;
  return entry;
}

// Returns { name, names, history, modes? } ready to become a group, or throws an Error
// with a message for the user. Nothing is half-imported.
function parseGroupFile(text) {
  let data;
  try { data = JSON.parse(text); } catch {}
  if (!data || typeof data !== 'object' || data.format !== GROUP_FILE_FORMAT) {
    throw new Error('Filen är ingen gruppfil från Namnväljaren.');
  }
  if (data.version !== GROUP_FILE_VERSION) {
    throw new Error(`Gruppfilen har formatversion ${String(data.version)}, som den här sidan inte kan läsa.`);
  }
  if (!Array.isArray(data.names) || !data.names.every(n => typeof n === 'string')) {
    throw new Error('Gruppfilen har ingen giltig namnlista.');
  }
  if (data.history !== undefined && !Array.isArray(data.history)) {
    throw new Error('Gruppfilen har en ogiltig historik.');
  }
  const group = {
    name: (typeof data.name === 'string' && data.name.trim().slice(0, 40)) || 'Importerad grupp',
    names: data.names.map(n => n.trim().slice(0, 100)).filter(Boolean).join('\n'),
    history: (data.history ?? []).map(cleanEntry).filter(Boolean),
  };
  // Unknown methods are dropped; none or all left means all on, like a new group.
  if (Array.isArray(data.modes)) {
    const modes = MODES.filter(m => data.modes.includes(m));
    if (modes.length && modes.length < MODES.length) group.modes = modes;
  }
  return group;
}

// --- Page ---

// The export is UTF-8; a file in another encoding would garble åäö, so it's rejected.
async function readCsvText(file) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error('Filen är inte UTF-8, så den är ingen historikexport från Namnväljaren.');
  }
}

function chooseFile(accept, onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
  input.click();
}

// Saves, or undoes the change if it doesn't fit in localStorage.
function trySaveGroups(undo) {
  try {
    saveGroups();
    return true;
  } catch {
    undo();
    alert('Det fick inte plats i webbläsarens lagring.');
    return false;
  }
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// Resolves to 'merge', 'replace' or 'cancel'.
function askImportChoice(group, count) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('import-dialog'));
  document.getElementById('import-dialog-text').textContent =
    `"${group.name}" har redan ${plural(group.history.length, 'post', 'poster')} i historiken. ` +
    `Vill du slå ihop historiken med ${plural(count, 'posten', 'posterna')} från filen, eller ersätta den?`;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue || 'cancel'), { once: true }));
}

function importHistory() {
  if (spinning) return;
  chooseFile('.csv,text/csv', async file => {
    let entries;
    try {
      entries = historyFromCsv(await readCsvText(file));
    } catch (e) {
      alert(e.message || 'Filen kunde inte läsas.');
      return;
    }
    if (!entries.length) {
      alert('Filen innehöll inga val.');
      return;
    }
    const group = activeGroup();
    const choice = group.history.length ? await askImportChoice(group, entries.length) : 'replace';
    if (choice === 'cancel' || spinning) return;

    const before = group.history;
    let summary;
    if (choice === 'merge') {
      const merged = mergeHistory(before, entries);
      group.history = merged.history;
      summary = plural(merged.added, 'post importerad', 'poster importerade');
      if (merged.duplicates) summary += `, ${plural(merged.duplicates, 'dubblett', 'dubbletter')} hoppades över`;
    } else {
      group.history = entries;
      summary = plural(entries.length, 'post importerad', 'poster importerade');
    }
    if (!trySaveGroups(() => { group.history = before; })) return;
    historyShowAll = false;
    renderHistory();
    alert(summary + '.');
  });
}

function exportGroup() {
  const group = activeGroup();
  downloadFile(exportFileName(group, 'json'), groupFile(group), 'application/json');
}

// Always makes a new group (tab); never overwrites one.
function importGroup() {
  if (spinning) return;
  chooseFile('.json,application/json', async file => {
    let imported;
    try {
      imported = parseGroupFile(await file.text());
    } catch (e) {
      alert(e.message || 'Filen kunde inte läsas.');
      return;
    }
    if (spinning) return;
    const group = { id: newId(), ...imported, name: uniqueGroupName(imported.name) };
    const previous = state.active;
    state.groups.push(group);
    state.active = group.id;
    if (!trySaveGroups(() => { state.groups.pop(); state.active = previous; })) return;
    showActiveGroup();
  });
}

function toggleFileSettings() {
  const panel = document.getElementById('file-settings');
  const open = panel.hidden;
  panel.hidden = !open;
  document.getElementById('file-settings-btn').setAttribute('aria-expanded', String(open));
}
