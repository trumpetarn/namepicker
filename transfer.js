// Files: import history from CSV (our own export, or an old spreadsheet saved as CSV),
// and export/import a whole group as JSON. Files are read locally only.

// --- Reading CSV ---

// Our export uses semicolons; a CSV saved by Excel in another locale may use commas or tabs.
function parseCsv(text) {
  text = text.replace(/^\ufeff/, '');
  const end = text.search(/[\r\n]/);
  const firstLine = end < 0 ? text : text.slice(0, end);
  const delims = [';', ',', '\t'];
  const counts = delims.map(d => firstLine.split(d).length);
  const delim = delims[counts.indexOf(Math.max(...counts))];

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
    } else if (c === delim) {
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

// --- Rows to history entries ---

const HEADERS = {
  name: ['namn', 'name'],
  date: ['datum', 'date', 'dag', 'day'],
  method: ['metod', 'method'],
  time: ['tid', 'time', 'klockslag'],
};

function cellText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

// Finds the header row: preferably one with both a name and a date column, as a sheet can
// hold other small tables (like a count per name) next to the history.
function findHeader(rows) {
  const columns = (row, kind) => row.flatMap((v, i) => HEADERS[kind].includes(cellText(v).toLowerCase()) ? [i] : []);
  const nearest = (cols, to) => cols.length ? cols.reduce((a, b) => Math.abs(b - to) < Math.abs(a - to) ? b : a) : -1;
  for (const needDate of [true, false]) {
    for (let r = 0; r < rows.length; r++) {
      const names = columns(rows[r], 'name');
      const dates = columns(rows[r], 'date');
      if (!names.length || (needDate && !dates.length)) continue;
      // With several name columns, take the one closest to a date column.
      const gap = col => Math.abs(col - nearest(dates, col));
      const name = dates.length ? names.reduce((a, b) => gap(b) < gap(a) ? b : a) : names[0];
      return {
        row: r,
        name,
        date: nearest(dates, name),
        method: nearest(columns(rows[r], 'method'), name),
        time: nearest(columns(rows[r], 'time'), name),
      };
    }
  }
  return null;
}

function timeParts(value) {
  const m = cellText(value).match(/^(\d{1,2})[:.](\d{2})/);
  return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], mi: +m[2] } : null;
}

// A YYYY-MM-DD date cell plus an optional time cell, read as Swedish local time, to an
// ISO string; null if there's no valid date.
function cellDate(value, time) {
  const m = cellText(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m || +m[1] < 1900) return null;
  const parts = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0) };
  const t = cellText(time) ? timeParts(time) : null;
  if (t) Object.assign(parts, t);
  const date = new Date(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi);
  if (date.getFullYear() !== parts.y || date.getMonth() !== parts.mo - 1 || date.getDate() !== parts.d) return null;
  return date.toISOString();
}

// One of our methods by display name ("Lyckohjulet") or id ("wheel").
function modeFromMethod(text) {
  const lower = text.toLowerCase();
  return MODES.find(m => m === lower || MODE_NAMES[m].toLowerCase() === lower);
}

// Newest first; entries without a date last, in their original order.
function byDateDesc(a, b) {
  const ta = a.date ? Date.parse(a.date) : -Infinity;
  const tb = b.date ? Date.parse(b.date) : -Infinity;
  return ta === tb ? 0 : tb > ta ? 1 : -1;
}

// Returns { entries, noDate } or null if no header row is found. Rows without a name, or with
// just "-" (a day without a pick in the old spreadsheets), are skipped.
function historyFromRows(rows) {
  const h = findHeader(rows);
  if (!h) return null;
  const entries = [];
  let noDate = 0;
  for (const row of rows.slice(h.row + 1)) {
    const name = cellText(row[h.name]).slice(0, 100);
    if (!name || /^-+$/.test(name)) continue;
    const entry = { name };
    const method = h.method >= 0 ? cellText(row[h.method]) : '';
    const mode = modeFromMethod(method);
    if (mode) entry.mode = mode;
    else if (method) entry.method = method.slice(0, 60);
    entry.date = h.date >= 0 ? cellDate(row[h.date], h.time >= 0 ? row[h.time] : '') : null;
    if (!entry.date) noDate++;
    entries.push(entry);
  }
  return { entries: entries.sort(byDateDesc), noDate };
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

// Old spreadsheets saved as CSV by Swedish Excel are Windows-1252, not UTF-8.
function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

async function readCsvFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return parseCsv(decodeText(bytes)).map(row => row.map(unguardCell));
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
  chooseFile('.csv,.txt,text/csv', async file => {
    let found;
    try {
      found = historyFromRows(await readCsvFile(file));
    } catch {
      alert('Filen kunde inte läsas.');
      return;
    }
    if (!found) {
      alert('Hittade ingen historik i filen. Den behöver en rubrikrad med Namn, och gärna Datum, Tid och Metod.');
      return;
    }
    if (!found.entries.length) {
      alert('Filen innehöll inga val.');
      return;
    }
    const group = activeGroup();
    const choice = group.history.length ? await askImportChoice(group, found.entries.length) : 'replace';
    if (choice === 'cancel' || spinning) return;

    const before = group.history;
    let summary;
    if (choice === 'merge') {
      const merged = mergeHistory(before, found.entries);
      group.history = merged.history;
      summary = plural(merged.added, 'post importerad', 'poster importerade');
      if (merged.duplicates) summary += `, ${plural(merged.duplicates, 'dubblett', 'dubbletter')} hoppades över`;
    } else {
      group.history = found.entries;
      summary = plural(found.entries.length, 'post importerad', 'poster importerade');
    }
    if (found.noDate) summary += `. ${plural(found.noDate, 'rad', 'rader')} saknade giltigt datum och sparades utan datum`;
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
