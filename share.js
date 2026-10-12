// Share links: a group encoded in the URL fragment, imported on load.

// The group travels in the URL fragment (#dela=…), so it never reaches the server.
function encodeShare(group) {
  const json = JSON.stringify({ n: group.name, l: namesFromText(group.names) });
  let bin = '';
  new TextEncoder().encode(json).forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeShare(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (typeof data.n !== 'string' || !Array.isArray(data.l)) return null;
    const names = data.l.filter(n => typeof n === 'string').map(n => n.trim().slice(0, 100)).filter(Boolean).slice(0, 500);
    return { name: data.n.trim().slice(0, 40) || 'Delad grupp', names };
  } catch {
    return null;
  }
}

async function shareGroup() {
  const group = activeGroup();
  const url = `${location.origin}${location.pathname}#dela=${encodeShare(group)}`;
  const btn = document.getElementById('share-group');
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: `Namnväljare – ${group.name}`, url }); } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Länk kopierad!';
    setTimeout(() => btn.textContent = 'Dela', 2000);
  } catch {
    prompt('Kopiera länken:', url);
  }
}

function importFromHash() {
  const match = location.hash.match(/^#dela=([A-Za-z0-9_-]+)$/);
  if (!match) return;
  window.history.replaceState(null, '', location.pathname + location.search);
  const shared = decodeShare(match[1]);
  if (!shared) {
    alert('Delningslänken kunde inte läsas.');
    return;
  }
  const text = shared.names.join('\n');
  const existing = state.groups.find(g => g.name === shared.name && namesFromText(g.names).join('\n') === text);
  if (existing) {
    state.active = existing.id;
  } else {
    if (!confirm(`Lägg till gruppen "${shared.name}" med ${shared.names.length} namn?`)) return;
    const group = { id: newId(), name: uniqueGroupName(shared.name), names: text, history: [] };
    state.groups.push(group);
    state.active = group.id;
  }
  saveGroups();
}
