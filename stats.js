// Statistics over the active group's history: picks per person and per method, and a
// table of method per person, for a chosen period. Excluded entries don't count
// (includedEntries in history.js).

const STATS_PERIODS = { all: 'Allt', year: 'I år', '90d': 'Senaste 3 månaderna', '30d': 'Senaste 30 dagarna' };
const UNKNOWN_METHOD = 'Okänd';
const OTHER_METHODS = 'Övriga';
// Method per person gets a column for each of the most used methods; the rest share one.
const MATRIX_METHODS = 4;

let statsShown = false;
let statsPeriod = 'all';

// The first moment of the period, or null for all time.
function periodStart(period, now = new Date()) {
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  if (period === '90d') return new Date(now.getTime() - 90 * 86400000);
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000);
  return null;
}

// names: the group's current list, so people who were never picked show up with 0.
// Entries without a date only count for all time. Sorted by count, then name.
function computeStats(history, names, period = 'all', now = new Date()) {
  const start = periodStart(period, now);
  const entries = includedEntries(history).filter(e => !start || (e.date && new Date(e.date) >= start));
  const methodOf = e => entryMethod(e) || UNKNOWN_METHOD;
  const tally = keyOf => {
    const counts = new Map();
    for (const e of entries) counts.set(keyOf(e), (counts.get(keyOf(e)) || 0) + 1);
    return counts;
  };
  const sorted = counts => [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'sv'));

  const byName = tally(e => e.name);
  for (const name of names) if (!byName.has(name)) byName.set(name, 0);
  const perPerson = sorted(byName);
  const perMethod = sorted(tally(methodOf));

  // Folding a single leftover method into "Övriga" would hide its name for nothing.
  const own = perMethod.length > MATRIX_METHODS + 1 ? perMethod.slice(0, MATRIX_METHODS) : perMethod;
  const columns = own.map(m => m.key);
  if (own.length < perMethod.length) columns.push(OTHER_METHODS);
  const rows = perPerson.map(({ key, count }) => {
    const cells = columns.map(() => 0);
    for (const e of entries) {
      if (e.name !== key) continue;
      const i = columns.indexOf(methodOf(e));
      cells[i >= 0 && i < own.length ? i : columns.length - 1]++;
    }
    return { name: key, cells, total: count };
  });

  return { total: entries.length, perPerson, perMethod, matrix: { columns, rows } };
}

// --- Page ---

function statsEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function percent(count, total) {
  return total ? `${Math.round((count / total) * 100)} %` : '';
}

// A ranked bar chart as a table, so the numbers are there for screen readers too.
// Names are set with textContent: they can come from someone else's link or file.
function barTable(caption, header, items, total) {
  const table = statsEl('table', 'stat-bars');
  table.append(statsEl('caption', '', caption));
  const head = statsEl('thead', 'visually-hidden');
  const headRow = statsEl('tr');
  for (const text of [header, 'Antal val']) {
    const th = statsEl('th', '', text);
    th.setAttribute('scope', 'col');
    headRow.append(th);
  }
  head.append(headRow);
  const body = statsEl('tbody');
  const max = Math.max(1, ...items.map(i => i.count));
  for (const { key, count } of items) {
    const row = statsEl('tr');
    const name = statsEl('th', '', key);
    name.setAttribute('scope', 'row');
    name.title = key;
    const cell = statsEl('td');
    const wrap = statsEl('div', 'bar-cell');
    const bar = statsEl('span', 'bar');
    bar.style.setProperty('--ratio', String(count / max));
    bar.setAttribute('aria-hidden', 'true');
    const value = statsEl('span', 'bar-value', count ? `${count} · ${percent(count, total)}` : '0');
    wrap.append(bar, value);
    cell.append(wrap);
    row.append(name, cell);
    body.append(row);
  }
  table.append(head, body);
  return table;
}

function matrixTable({ columns, rows }) {
  const wrap = statsEl('div', 'stat-matrix-wrap');
  const table = statsEl('table', 'stat-matrix');
  table.append(statsEl('caption', '', 'Metod per person'));
  const headRow = statsEl('tr');
  for (const text of ['Namn', ...columns, 'Totalt']) {
    const th = statsEl('th', '', text);
    th.setAttribute('scope', 'col');
    headRow.append(th);
  }
  const head = statsEl('thead');
  head.append(headRow);
  const body = statsEl('tbody');
  for (const { name, cells, total } of rows) {
    const row = statsEl('tr');
    const th = statsEl('th', '', name);
    th.setAttribute('scope', 'row');
    row.append(th);
    for (const n of [...cells, total]) row.append(statsEl('td', n ? '' : 'zero', n ? String(n) : '–'));
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function renderStats() {
  const group = activeGroup();
  const stats = computeStats(group.history, namesFromText(group.names), statsPeriod);
  const select = /** @type {HTMLSelectElement} */ (document.getElementById('stats-period'));
  select.value = statsPeriod;
  const content = document.getElementById('stats-content');
  const people = stats.perPerson.filter(p => p.count).length;
  document.getElementById('stats-summary').textContent = stats.total
    ? `${stats.total} val av ${people} ${people === 1 ? 'person' : 'personer'}`
    : 'Inga val under perioden.';
  if (!stats.total) {
    content.replaceChildren();
    return;
  }
  content.replaceChildren(
    barTable('Val per person', 'Namn', stats.perPerson, stats.total),
    barTable('Val per metod', 'Metod', stats.perMethod, stats.total),
    matrixTable(stats.matrix),
  );
}

function toggleStats() {
  statsShown = !statsShown;
  renderHistory();
}

function setStatsPeriod(period) {
  if (!STATS_PERIODS[period]) return;
  statsPeriod = period;
  renderStats();
}
