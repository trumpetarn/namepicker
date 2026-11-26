// Named groups: localStorage state, tabs, and add/rename/delete.

// Groups: { active: id, groups: [{ id, name, names: <textarea text>, history: [{ name, mode, date }],
//           modes?: [enabled methods; all when missing] }] }
// A history entry imported from elsewhere may have method (free text, e.g. "Wheel of Names")
// instead of mode, and entries saved before modes were recorded have neither.
const GROUPS_KEY = 'namepicker-groups';

const MODES = ['wheel', 'hat', 'slot', 'remote', 'gift'];
const MODE_NAMES = { wheel: 'Lyckohjulet', hat: 'Hatten', slot: 'Enarmade banditen', remote: 'Fjärrkontrollen', gift: 'Julklappen' };
// Methods that only take part in one colour mode (currentTheme() in theme.js): Julklappen
// in Jul. Elsewhere they're hidden from the method row, Metoder and Slumpa, but the
// history still names them and a group keeps whether they're switched on.
const SEASONAL_MODES = { gift: 'christmas' };

function availableModes(theme = currentTheme()) {
  return MODES.filter(m => !SEASONAL_MODES[m] || SEASONAL_MODES[m] === theme);
}

// A group's modes setting after choosing the methods `on` among `available`. Methods not
// available now (Julklappen outside Jul) keep their previous setting. Returns null when
// everything is on, so such groups follow new methods too.
function modesSetting(previous, on, available) {
  const before = Array.isArray(previous) ? previous : MODES;
  const after = MODES.filter(m => available.includes(m) ? on.includes(m) : before.includes(m));
  return after.length === MODES.length ? null : after;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(GROUPS_KEY));
    if (saved && Array.isArray(saved.groups) && saved.groups.length) return saved;
  } catch {}
  // First run with groups: move the old single list and history into a group.
  let history = [];
  try {
    history = (JSON.parse(localStorage.getItem('namepicker-history')) || []).map(entry =>
      typeof entry === 'string' ? { name: entry, date: null } : entry
    );
  } catch {}
  const group = { id: newId(), name: 'Min grupp', names: localStorage.getItem('namepicker-names') || '', history };
  return { active: group.id, groups: [group] };
}

let state = loadGroups();

function saveGroups() {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
}

function activeGroup() {
  return state.groups.find(g => g.id === state.active) || state.groups[0];
}

function namesFromText(text) {
  return text.split('\n').map(n => n.trim()).filter(n => n.length > 0);
}

function updateGroupControls() {
  /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('#group-bar button')).forEach(b => b.disabled = spinning);
  if (state.groups.length === 1) /** @type {HTMLButtonElement} */ (document.getElementById('delete-group')).disabled = true;
}

function renderTabs() {
  const tabs = document.getElementById('group-tabs');
  tabs.replaceChildren();
  for (const group of state.groups) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'group-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(group.id === state.active));
    tab.textContent = group.name;
    tab.title = group.name;
    tab.addEventListener('click', () => switchGroup(group.id));
    tab.addEventListener('dblclick', renameGroup);
    tabs.appendChild(tab);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'group-tab group-add';
  add.textContent = '+';
  add.title = 'Ny grupp';
  add.setAttribute('aria-label', 'Ny grupp');
  add.addEventListener('click', addGroup);
  tabs.appendChild(add);
  tabs.querySelector('[aria-selected="true"]').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  updateGroupControls();
}

function showActiveGroup() {
  textarea.value = activeGroup().names;
  autoResize();
  updatePickEnabled();
  chosen.className = '';
  chosen.textContent = '';
  hideUndo();
  reelPos = 0;
  resetHat();
  updateToggleLabel();
  renderTabs();
  renderHistory();
  applyEnabledModes();
  refreshStage();
}

function switchGroup(id) {
  if (spinning || id === state.active) return;
  state.active = id;
  saveGroups();
  showActiveGroup();
}

function uniqueGroupName(name) {
  let result = name;
  for (let i = 2; state.groups.some(g => g.name === result); i++) result = `${name} (${i})`;
  return result;
}

function addGroup() {
  const name = (prompt('Namn på den nya gruppen:') || '').trim().slice(0, 40);
  if (!name) return;
  const group = { id: newId(), name: uniqueGroupName(name), names: '', history: [] };
  state.groups.push(group);
  switchGroup(group.id);
  textarea.focus();
}

function renameGroup() {
  if (spinning) return;
  const group = activeGroup();
  const name = (prompt('Nytt namn på gruppen:', group.name) || '').trim().slice(0, 40);
  if (!name || name === group.name) return;
  group.name = uniqueGroupName(name);
  saveGroups();
  renderTabs();
}

function deleteGroup() {
  if (spinning || state.groups.length === 1) return;
  const group = activeGroup();
  if (!confirm(`Ta bort gruppen "${group.name}" med namnlista och historik?`)) return;
  const idx = state.groups.indexOf(group);
  state.groups.splice(idx, 1);
  state.active = state.groups[Math.max(0, idx - 1)].id;
  saveGroups();
  showActiveGroup();
}
