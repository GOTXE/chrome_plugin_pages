import {
  addSaved, classify, domainOf, getSaved, getSettings, isSavable,
  normalizeDomain, removeSaved, saveSettings, toMarkdown, urlKey,
} from '../shared/store.js';

const $ = (id) => document.getElementById(id);
const mode = new URLSearchParams(location.search).get('mode') === 'panel' ? 'panel' : 'popup';
document.body.classList.add(`mode-${mode}`);

let settings;
let openTabs = [];           // pestañas abiertas con su clasificación
const overrides = new Map(); // tabId -> true/false (decisión manual del usuario)
let windowNumbers = new Map(); // windowId -> número de ventana mostrado
let copiesByKey = new Map();   // clave de URL -> pestañas abiertas con esa URL

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function favicon(url) {
  if (!url) return el('span', { className: 'ico' });
  const img = el('img', { src: url, alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(el('span', { className: 'ico' })));
  return img;
}

// Icono que guarda el propio navegador, para las guardadas que llegan desde otro dispositivo.
function faviconFor(pageUrl) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '16');
  return url.href;
}

let toastTimer;
function toast(text) {
  const node = $('toast');
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2500);
}

// ---------- Navegación ----------

function showView(name) {
  for (const btn of document.querySelectorAll('.tabs button')) {
    btn.setAttribute('aria-selected', String(btn.dataset.view === name));
  }
  for (const view of ['tabs', 'saved', 'settings']) $(`view-${view}`).hidden = view !== name;
  if (name === 'tabs') loadTabs();
  if (name === 'saved') renderSaved();
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) showView(btn.dataset.view);
});

// ---------- Pestañas abiertas ----------

async function loadTabs() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const alive = new Set(tabs.map((tab) => tab.id));
  for (const id of overrides.keys()) if (!alive.has(id)) overrides.delete(id);
  const savedKeys = new Set((await getSaved()).map((item) => urlKey(item.url)));
  openTabs = tabs.map((tab) => {
    const key = urlKey(tab.url);
    return { tab, key, alreadySaved: savedKeys.has(key), ...classify(tab, settings, now) };
  });
  renderTabs();
}

function isSelected(entry) {
  if (!isSavable(entry.tab)) return false;
  return overrides.has(entry.tab.id) ? overrides.get(entry.tab.id) : entry.action === 'later';
}

function renderTabs() {
  const list = $('tabs-list');
  list.replaceChildren();

  const byWindow = Map.groupBy(openTabs, (entry) => entry.tab.windowId);
  windowNumbers = new Map([...byWindow.keys()].map((id, i) => [id, i + 1]));
  copiesByKey = Map.groupBy(openTabs.filter((entry) => isSavable(entry.tab)), (entry) => entry.key);
  for (const [windowId, entries] of byWindow) {
    const windowNumber = windowNumbers.get(windowId);
    const marked = entries.filter(isSelected).length;
    list.append(el('li', { className: 'group', textContent: `Ventana ${windowNumber} · ${entries.length} pestañas · ${marked} marcadas` }));
    appendRows(list, [...entries].sort((a, b) => Number(isSelected(b)) - Number(isSelected(a))));
  }
  updateSummary();
}

function appendRows(list, entries) {
  for (const entry of entries) {
    const { tab, reason } = entry;
    const savable = isSavable(tab);
    const checkbox = el('input', { type: 'checkbox', checked: isSelected(entry), disabled: !savable });
    checkbox.addEventListener('change', () => {
      overrides.set(tab.id, checkbox.checked);
      updateSummary();
    });

    const domain = domainOf(tab.url);
    const keepBtn = el('button', { className: 'icon-btn', textContent: '🔒', title: `No proponer nunca ${domain}` });
    const laterBtn = el('button', { className: 'icon-btn', textContent: '📖', title: `${domain} siempre para leer luego` });
    keepBtn.addEventListener('click', () => addDomainRule('keepDomains', 'laterDomains', domain));
    laterBtn.addEventListener('click', () => addDomainRule('laterDomains', 'keepDomains', domain));

    const meta = el('span', { className: 'meta', textContent: `${domain || 'interna'} · ${reason}` });
    const copies = savable ? copiesByKey.get(entry.key) : null;
    if (copies?.length > 1) {
      const where = [...new Set(copies.map((copy) => windowNumbers.get(copy.tab.windowId)))].sort((a, b) => a - b);
      const hint = `Duplicada ×${copies.length} (ventana ${where.join(', ')})`;
      meta.append(' · ', el('span', { className: 'tag dup', textContent: `🔁×${copies.length}`, title: hint, ariaLabel: hint }));
    }
    if (entry.alreadySaved) {
      meta.append(' · ', el('span', { className: 'tag saved', textContent: '✅', title: 'Ya está en guardadas', ariaLabel: 'Ya guardada' }));
    }

    const label = el('label', { className: 'text' },
      el('span', { className: 'title', textContent: tab.title || tab.url, title: tab.url }),
      meta,
    );
    const row = el('li', {}, checkbox, favicon(tab.favIconUrl), label);
    if (savable && domain) row.append(keepBtn, laterBtn);
    list.append(row);
  }
}

function updateSummary() {
  const selected = openTabs.filter(isSelected).length;
  const windows = new Set(openTabs.map((entry) => entry.tab.windowId)).size;
  $('tabs-summary').textContent = `${openTabs.length} pestañas en ${windows} ventanas · ${selected} marcadas para guardar y cerrar`;
  $('save-close').textContent = selected ? `Guardar y cerrar (${selected})` : 'Guardar y cerrar';
  $('save-close').disabled = selected === 0;
}

// Guarda la regla de dominio (el "aprendizaje") y reevalúa las pestañas de ese dominio.
async function addDomainRule(target, other, domain) {
  const next = {
    [target]: [...new Set([...settings[target], domain])],
    [other]: settings[other].filter((d) => d !== domain),
  };
  settings = await saveSettings(next);
  for (const entry of openTabs) {
    if (domainOf(entry.tab.url) === domain) overrides.delete(entry.tab.id);
  }
  toast(target === 'keepDomains' ? `${domain}: se mantiene siempre` : `${domain}: siempre para leer luego`);
  await loadTabs();
  renderSettings();
}

$('save-close').addEventListener('click', async () => {
  const chosen = openTabs.filter(isSelected).map((entry) => entry.tab);
  if (!chosen.length) return;
  $('save-close').disabled = true;
  try {
    // Primero se guarda; solo si funciona se cierran las pestañas.
    const added = await addSaved(chosen);

    // Si una ventana se quedara sin pestañas, se deja una nueva para que no se cierre.
    const closing = new Set(chosen.map((tab) => tab.id));
    const byWindow = Map.groupBy(openTabs.map((entry) => entry.tab), (tab) => tab.windowId);
    for (const [windowId, tabs] of byWindow) {
      if (tabs.every((tab) => closing.has(tab.id))) await chrome.tabs.create({ windowId });
    }

    await chrome.tabs.remove([...closing]);
    toast(`${chosen.length} cerradas · ${added} guardadas${added < chosen.length ? ' (el resto ya estaba)' : ''}`);
    overrides.clear();
    await loadTabs();
    await updateSavedCount();
  } catch (err) {
    console.error(err);
    toast('Error al guardar. No se ha cerrado nada.');
    $('save-close').disabled = false;
  }
});

// ---------- Guardadas ----------

async function updateSavedCount() {
  $('saved-count').textContent = String((await getSaved()).length);
}

async function renderSaved() {
  const query = $('saved-search').value.trim().toLowerCase();
  const items = (await getSaved()).filter((item) =>
    !query || `${item.title} ${item.domain}`.toLowerCase().includes(query));
  const list = $('saved-list');
  list.replaceChildren();

  if (!items.length) {
    list.append(el('li', { className: 'empty', textContent: query ? 'Sin resultados' : 'Aún no hay nada guardado' }));
  }
  for (const item of items) {
    const link = el('a', { className: 'title', textContent: item.title, href: item.url, title: 'Abrir y quitar de la lista' });
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      await chrome.tabs.create({ url: item.url });
      await removeSaved([item.id]);
      await updateSavedCount();
      renderSaved();
    });
    const del = el('button', { className: 'icon-btn', textContent: '✕', title: 'Quitar sin abrir' });
    del.addEventListener('click', async () => {
      await removeSaved([item.id]);
      await updateSavedCount();
      renderSaved();
    });
    const text = el('div', { className: 'text' }, link,
      el('span', { className: 'meta', textContent: `${item.domain} · ${new Date(item.savedAt).toLocaleDateString()}` }));
    list.append(el('li', {}, favicon(item.favIconUrl || faviconFor(item.url)), text, del));
  }
}

$('saved-search').addEventListener('input', renderSaved);

$('copy-urls').addEventListener('click', async () => {
  const items = await getSaved();
  if (!items.length) return toast('No hay nada que copiar');
  try {
    await navigator.clipboard.writeText(items.map((item) => item.url).join('\n'));
    toast(`${items.length} URL copiadas`);
  } catch (err) {
    console.error(err);
    toast('No se pudo copiar');
  }
});

$('export-md').addEventListener('click', async () => {
  const items = await getSaved();
  if (!items.length) return toast('No hay nada que exportar');
  const url = URL.createObjectURL(new Blob([toMarkdown(items)], { type: 'text/markdown' }));
  const a = el('a', { href: url, download: `leer-luego-${new Date().toISOString().slice(0, 10)}.md` });
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Ajustes ----------

function renderSettings() {
  for (const radio of document.querySelectorAll('input[name="uiMode"]')) {
    radio.checked = radio.value === settings.uiMode;
  }
  $('idle-days').value = settings.idleDays;
  $('sync-bookmarks').checked = settings.syncBookmarks;
  $('keep-domains').value = settings.keepDomains.join('\n');
  $('later-domains').value = settings.laterDomains.join('\n');
}

function parseDomains(text) {
  return [...new Set(text.split('\n').map(normalizeDomain).filter(Boolean))];
}

if (!chrome.sidePanel) {
  $('mode-panel').disabled = true;
  $('panel-unsupported').hidden = false;
}

// Muestra el estado real del icono y, si el popup se abrió estando elegido el panel,
// vuelve a aplicar el modo y ofrece abrir el panel desde aquí (con un clic real del usuario).
async function checkUiMode() {
  const popup = await chrome.action.getPopup({});
  const behavior = chrome.sidePanel ? await chrome.sidePanel.getPanelBehavior() : null;
  $('ui-state').textContent = `Estado: ajuste=${settings.uiMode} · esta vista=${mode} · popup=${popup ? 'definido' : 'vacío'} · el icono abre el panel=${behavior?.openPanelOnActionClick ?? 'n/d'}`;

  if (mode === 'popup' && settings.uiMode === 'panel' && chrome.sidePanel) {
    $('mode-banner').hidden = false;
    chrome.runtime.sendMessage({ type: 'apply-ui' }).catch(() => {});
  }
}

$('open-panel').addEventListener('click', async () => {
  try {
    const win = await chrome.windows.getLastFocused();
    await chrome.sidePanel.open({ windowId: win.id });
    window.close();
  } catch (err) {
    console.error(err);
    toast('No se pudo abrir el panel lateral');
  }
});

document.querySelectorAll('input[name="uiMode"]').forEach((radio) => {
  radio.addEventListener('change', async () => {
    settings = await saveSettings({ uiMode: radio.value });
    await chrome.runtime.sendMessage({ type: 'apply-ui' }).catch(() => {});
    await checkUiMode();
    toast(radio.value === 'panel'
      ? 'Panel lateral activado: se abrirá al pulsar el icono'
      : 'Popup activado');
  });
});

$('sync-bookmarks').addEventListener('change', async () => {
  settings = await saveSettings({ syncBookmarks: $('sync-bookmarks').checked });
});
$('idle-days').addEventListener('change', async () => {
  const days = Math.max(0, Math.min(365, Number($('idle-days').value) || 0));
  settings = await saveSettings({ idleDays: days });
});
$('keep-domains').addEventListener('change', async () => {
  settings = await saveSettings({ keepDomains: parseDomains($('keep-domains').value) });
});
$('later-domains').addEventListener('change', async () => {
  settings = await saveSettings({ laterDomains: parseDomains($('later-domains').value) });
});

// ---------- Actualización en vivo ----------
// El panel lateral queda abierto, así que la lista se refresca cuando cambian las pestañas.

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (document.hidden) return;
    if (!$('view-tabs').hidden) {
      const list = $('tabs-list');
      const scroll = list.scrollTop;
      await loadTabs();
      list.scrollTop = scroll;
    }
    if (!$('view-saved').hidden) await renderSaved();
    await updateSavedCount();
  }, 400);
}

const tabEvents = ['onCreated', 'onRemoved', 'onMoved', 'onAttached', 'onDetached', 'onReplaced', 'onActivated'];
for (const name of tabEvents) chrome.tabs[name].addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const relevant = ['url', 'title', 'pinned', 'audible', 'groupId', 'favIconUrl'];
  if (relevant.some((key) => key in changeInfo)) scheduleRefresh();
});
chrome.windows.onRemoved.addListener(scheduleRefresh);
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) settings = await getSettings();
  if (changes.saved || changes.settings) scheduleRefresh();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleRefresh();
});

// ---------- Inicio ----------

settings = await getSettings();
renderSettings();
await checkUiMode();
await updateSavedCount();
await loadTabs();
