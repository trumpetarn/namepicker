// Files: import history from CSV (our own export or an old spreadsheet saved as CSV) or
// Excel (.xlsx), and export/import a whole group as JSON. Files are read locally only.

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

// --- Reading Excel (.xlsx) ---

// An .xlsx file is a zip of XML files. Returns { path: Uint8Array } for the files wanted.
async function unzip(bytes, wanted) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const files = {};
  let p = view.getUint32(eocd + 16, true);
  for (let n = view.getUint16(eocd + 10, true); n > 0; n--) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    if (!wanted(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) files[name] = data;
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      files[name] = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error('unsupported zip compression');
  }
  return files;
}

function xmlText(xml) {
  return xml.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, named) =>
    hex ? String.fromCodePoint(parseInt(hex, 16))
      : dec ? String.fromCodePoint(Number(dec))
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()]);
}

// The text of a shared string or inline string: all its <t> runs, without phonetic hints.
function xmlRuns(xml) {
  return xmlText([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map(m => m[1]).join(''));
}

function columnIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// Returns { sheets: [rows of cells], date1904 }. Number cells stay numbers, so dates
// (stored as day counts) can be told apart from text.
async function readXlsx(bytes) {
  const files = await unzip(bytes, name =>
    name === 'xl/workbook.xml' || name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const text = name => files[name] ? new TextDecoder().decode(files[name]) : '';
  const strings = [...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => xmlRuns(m[1]));
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(text('xl/workbook.xml'));
  const sheetNames = Object.keys(files).filter(n => n.startsWith('xl/worksheets/'))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  const sheets = sheetNames.map(name => {
    const rows = [];
    for (const [, attrs, body = ''] of text(name).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value;
      if (type === 's') value = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') value = xmlRuns(body);
      else if (type === 'str' || type === 'e') value = xmlText(v ?? '');
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else value = v === undefined ? '' : Number(v);
      const r = Number(ref[2]) - 1;
      (rows[r] ??= [])[columnIndex(ref[1])] = value;
    }
    return Array.from(rows, row => row ?? []);
  });
  return { sheets, date1904 };
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

// An Excel date: days since 1899-12-30 (or 1904-01-01), with the time of day as the fraction.
function serialParts(serial, date1904) {
  if (!(serial > 0)) return null;
  let days = Math.floor(serial);
  let minutes = Math.round((serial - days) * 1440);
  if (minutes === 1440) { days++; minutes = 0; }
  const d = new Date((date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + days * 86400000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: Math.floor(minutes / 60), mi: minutes % 60 };
}

function timeParts(value) {
  if (typeof value === 'number') {
    const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
    return { h: Math.floor(minutes / 60), mi: minutes % 60 };
  }
  const m = cellText(value).match(/^(\d{1,2})[:.](\d{2})/);
  return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], mi: +m[2] } : null;
}

// A date cell (Excel day count or YYYY-MM-DD) plus an optional time cell, read as Swedish
// local time, to an ISO string; null if there's no valid date.
function cellDate(value, time, date1904) {
  let parts = null;
  if (typeof value === 'number') parts = serialParts(value, date1904);
  else {
    const m = cellText(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) parts = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0) };
  }
  if (!parts || parts.y < 1900) return null;
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
function historyFromRows(rows, date1904 = false) {
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
    entry.date = h.date >= 0 ? cellDate(row[h.date], h.time >= 0 ? row[h.time] : '', date1904) : null;
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

async function readSheets(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes); // "PK": a zip, so .xlsx
  return { sheets: [parseCsv(decodeText(bytes)).map(row => row.map(unguardCell))], date1904: false };
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
  chooseFile('.csv,.xlsx,.txt,text/csv', async file => {
    let found;
    try {
      const { sheets, date1904 } = await readSheets(file);
      found = sheets.map(rows => historyFromRows(rows, date1904)).find(Boolean);
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
