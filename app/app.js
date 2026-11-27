import { MIN_CONFIDENCE, selectPending } from '../shared/ai.js';
import { CATEGORIES, categoryById } from '../shared/categories.js';
import {
  addSaved, classify, domainOf, getApiKey, getClassifications, getSaved, getSettings, getUsageToday,
  isSavable, normalizeDomain, removeSaved, saveSettings, setApiKey, toMarkdown, urlKey,
} from '../shared/store.js';

const $ = (id) => document.getElementById(id);
// Solo el popup lleva ?mode=popup; el panel lateral se carga desde el manifest, sin parámetros.
const mode = new URLSearchParams(location.search).get('mode') === 'popup' ? 'popup' : 'panel';
document.body.classList.add(`mode-${mode}`);

let settings;
let openTabs = [];           // pestañas abiertas con su clasificación
const overrides = new Map(); // tabId -> true/false (decisión manual del usuario)
let windowNumbers = new Map(); // windowId -> número de ventana mostrado
let copiesByKey = new Map();   // clave de URL -> pestañas abiertas con esa URL
let classifications = {};      // caché de la IA: clave de URL -> { category, action, confidence }
let apiKeySet = false;         // hay clave de OpenAI guardada (la clave en sí no se carga aquí)
const attempted = new Set();   // URL ya enviadas a la IA en esta sesión (evita reintentos en bucle)
const collapsed = new Set();   // grupos de guardadas plegados por el usuario
let aiRunning = false;         // hay una clasificación en curso (la ejecuta el servicio de fondo)
let bannerTimer;

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
  classifications = await getClassifications();
  openTabs = tabs.map((tab) => {
    const key = urlKey(tab.url);
    const entry = { tab, key, alreadySaved: savedKeys.has(key), ...classify(tab, settings, now) };
    // La IA solo decide donde las reglas dudan, y solo marca si está suficientemente segura.
    const ai = classifications[key];
    if (ai) {
      entry.ai = ai;
      if (entry.doubtful && ai.action === 'later' && ai.confidence >= MIN_CONFIDENCE) {
        entry.action = 'later';
        entry.reason = `🤖 ${categoryById(ai.category)?.label ?? ai.category}`;
      }
    }
    return entry;
  });
  renderTabs();
  await updateAiButtons();
  await autoClassify();
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
    const category = categoryById(entry.ai?.category);
    if (category) meta.append(' · ', categoryTag(category));

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

function categoryTag(category) {
  return el('span', { className: 'tag cat', textContent: category.emoji, title: category.label, ariaLabel: category.label });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_GROUPS = ['Hoy', 'Esta semana', 'Este mes', 'Antes'];

// Reparte las guardadas en grupos según el criterio elegido. Cada grupo: { id, label, items }.
function groupSaved(items, groupBy) {
  if (groupBy === 'none') return [{ id: 'all', label: null, items }];

  const groups = new Map();
  const add = (id, label, item) => {
    if (!groups.has(id)) groups.set(id, { id, label, items: [] });
    groups.get(id).items.push(item);
  };
  const now = Date.now();
  for (const item of items) {
    if (groupBy === 'category') {
      const category = categoryById(classifications[urlKey(item.url)]?.category);
      add(category?.id ?? 'sin', category ? `${category.emoji} ${category.label}` : 'Sin clasificar', item);
    } else if (groupBy === 'site') {
      add(item.domain || '?', item.domain || 'Sin dominio', item);
    } else {
      const age = now - item.savedAt;
      const label = age < DAY_MS ? DATE_GROUPS[0] : age < 7 * DAY_MS ? DATE_GROUPS[1] : age < 30 * DAY_MS ? DATE_GROUPS[2] : DATE_GROUPS[3];
      add(label, label, item);
    }
  }

  const list = [...groups.values()];
  if (groupBy === 'category') {
    const order = (group) => (group.id === 'sin' ? CATEGORIES.length : CATEGORIES.findIndex((c) => c.id === group.id));
    list.sort((a, b) => order(a) - order(b));
  } else if (groupBy === 'site') {
    list.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  } else {
    list.sort((a, b) => DATE_GROUPS.indexOf(a.id) - DATE_GROUPS.indexOf(b.id));
  }
  return list;
}

function savedRow(item, groupBy) {
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
  const meta = el('span', { className: 'meta', textContent: `${item.domain} · ${new Date(item.savedAt).toLocaleDateString()}` });
  const category = categoryById(classifications[urlKey(item.url)]?.category);
  if (category && groupBy !== 'category') meta.append(' · ', categoryTag(category));
  const text = el('div', { className: 'text' }, link, meta);
  return el('li', {}, favicon(item.favIconUrl || faviconFor(item.url)), text, del);
}

async function renderSaved() {
  classifications = await getClassifications();
  const query = $('saved-search').value.trim().toLowerCase();
  const items = (await getSaved()).filter((item) =>
    !query || `${item.title} ${item.domain}`.toLowerCase().includes(query));
  const list = $('saved-list');
  list.replaceChildren();

  if (!items.length) {
    list.append(el('div', { className: 'empty', textContent: query ? 'Sin resultados' : 'Aún no hay nada guardado' }));
  }
  const groupBy = settings.savedGroupBy;
  for (const group of groupSaved(items, groupBy)) {
    const rows = el('ul', { className: 'sublist' }, ...group.items.map((item) => savedRow(item, groupBy)));
    if (group.label === null) {
      list.append(rows);
      continue;
    }
    const foldKey = `${groupBy}:${group.id}`;
    const block = el('details', { className: 'group-block', open: !collapsed.has(foldKey) },
      el('summary', {}, group.label, el('span', { className: 'count', textContent: `(${group.items.length})` })),
      rows);
    block.addEventListener('toggle', () => {
      if (block.open) collapsed.delete(foldKey);
      else collapsed.add(foldKey);
    });
    list.append(block);
  }
  await updateAiButtons();
}

$('group-by').addEventListener('change', async () => {
  settings = await saveSettings({ savedGroupBy: $('group-by').value });
  renderSaved();
});

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

// ---------- Clasificación con IA ----------

const aiOn = () => settings.aiEnabled && apiKeySet;

function pendingTabs() {
  const doubtful = openTabs.filter((entry) => entry.doubtful).map((entry) => ({ url: entry.tab.url, title: entry.tab.title }));
  return selectPending(doubtful, settings, classifications);
}

async function pendingSaved() {
  const saved = (await getSaved()).map((item) => ({ url: item.url, title: item.title }));
  return selectPending(saved, settings, classifications);
}

async function updateAiButtons() {
  const manual = aiOn() && settings.aiMode === 'manual' && !aiRunning;
  const tabs = manual ? pendingTabs().length : 0;
  const saved = manual ? (await pendingSaved()).length : 0;
  $('ai-tabs').hidden = !tabs;
  $('ai-tabs').textContent = `🤖 Clasificar dudosas (${tabs})`;
  $('ai-saved').hidden = !saved;
  $('ai-saved').textContent = `🤖 Clasificar (${saved})`;
}

// La clasificación la hace el servicio de fondo, así no se corta si se cierra el popup.
async function requestClassification(items) {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'classify',
      entries: items.map(({ url, title }) => ({ url, title })),
    });
    // El progreso, el resultado y los errores los muestra el aviso superior (leído de storage).
    return !result?.error;
  } catch (err) {
    console.error(err);
    toast('🤖 No se pudo clasificar');
    return false;
  }
}

// Vista previa de exactamente lo que se enviará: solo dominio y título.
function confirmSend(items) {
  return new Promise((resolve) => {
    const dialog = $('ai-preview');
    $('ai-preview-summary').textContent = `Se enviarán ${items.length} URL a OpenAI, solo dominio y título:`;
    $('ai-preview-list').replaceChildren(...items.map((item) =>
      el('li', { textContent: `${item.domain} — ${item.title || '(sin título)'}` })));
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'send'), { once: true });
    dialog.showModal();
  });
}

async function manualClassify(button, getItems) {
  const items = await getItems();
  if (!items.length || !(await confirmSend(items))) return;
  button.disabled = true;
  await requestClassification(items);
  button.disabled = false;
}
$('ai-tabs').addEventListener('click', () => manualClassify($('ai-tabs'), async () => pendingTabs()));
$('ai-saved').addEventListener('click', () => manualClassify($('ai-saved'), pendingSaved));

// Modo automático: al abrir la interfaz, las pestañas dudosas y las guardadas sin clasificar.
// Las guardadas nuevas las clasifica el servicio nada más entrar.
async function autoClassify() {
  if (!aiOn() || settings.aiMode !== 'auto') return;
  const items = [...pendingTabs(), ...(await pendingSaved())].filter((item) => !attempted.has(item.key));
  if (!items.length) return;
  for (const item of items) attempted.add(item.key);
  await requestClassification(items);
}

// Aviso superior: progreso mientras clasifica, resultado al terminar y errores hasta que se cierren.
async function renderAiBanner() {
  const { aiProgress, aiStatus } = await chrome.storage.local.get(['aiProgress', 'aiStatus']);
  const banner = $('ai-banner');
  const bar = $('ai-progress');
  const close = $('ai-banner-close');
  clearTimeout(bannerTimer);
  banner.classList.remove('ok', 'err');
  bar.hidden = true;
  close.hidden = true;

  aiRunning = !!aiProgress?.running && Date.now() - aiProgress.startedAt < 5 * 60_000;
  if (aiRunning) {
    $('ai-banner-text').textContent = `🤖 Clasificando… ${aiProgress.done}/${aiProgress.total}`;
    bar.max = aiProgress.total;
    bar.value = aiProgress.done;
    bar.hidden = false;
    banner.hidden = false;
  } else if (aiStatus && !aiStatus.ok && !aiStatus.dismissed) {
    banner.classList.add('err');
    $('ai-banner-text').textContent = `⚠ ${aiStatus.message}`;
    close.hidden = false;
    banner.hidden = false;
  } else if (aiStatus?.ok && !aiStatus.dismissed && Date.now() - aiStatus.at < AI_DONE_VISIBLE_MS) {
    banner.classList.add('ok');
    close.hidden = false; // se puede cerrar antes de que desaparezca solo
    const left = aiStatus.skipped ? ` · ${aiStatus.skipped} quedan por el límite diario` : '';
    $('ai-banner-text').textContent = `✅ Clasificación terminada: ${aiStatus.classified} URL${left}`;
    banner.hidden = false;
    bannerTimer = setTimeout(renderAiBanner, AI_DONE_VISIBLE_MS - (Date.now() - aiStatus.at) + 50);
  } else {
    banner.hidden = true;
  }
  await updateAiButtons();
}

const AI_DONE_VISIBLE_MS = 15_000;

$('ai-banner-close').addEventListener('click', async () => {
  const { aiStatus } = await chrome.storage.local.get('aiStatus');
  if (aiStatus) await chrome.storage.local.set({ aiStatus: { ...aiStatus, dismissed: true } });
});

async function renderAiStatus() {
  const { aiStatus } = await chrome.storage.local.get('aiStatus');
  const used = await getUsageToday();
  const parts = [`Hoy: ${used}/${settings.aiDailyLimit} URL`];
  if (aiStatus?.ok) parts.push(`última pasada: ${aiStatus.classified} clasificadas (${new Date(aiStatus.at).toLocaleTimeString()})`);
  if (aiStatus && !aiStatus.ok) parts.push(`⚠ ${aiStatus.message}`);
  $('ai-status').textContent = parts.join(' · ');
}

// ---------- Ajustes ----------

function renderSettings() {
  for (const radio of document.querySelectorAll('input[name="uiMode"]')) {
    radio.checked = radio.value === settings.uiMode;
  }
  $('idle-days').value = settings.idleDays;
  $('sync-bookmarks').checked = settings.syncBookmarks;
  $('organize-bookmarks').checked = settings.organizeBookmarks;
  $('keep-domains').value = settings.keepDomains.join('\n');
  $('later-domains').value = settings.laterDomains.join('\n');
  $('group-by').value = settings.savedGroupBy;
  $('ai-enabled').checked = settings.aiEnabled;
  for (const radio of document.querySelectorAll('input[name="aiMode"]')) radio.checked = radio.value === settings.aiMode;
  $('ai-model').value = settings.aiModel;
  $('ai-limit').value = settings.aiDailyLimit;
  $('ai-key').placeholder = apiKeySet ? 'Clave guardada (escribe otra para cambiarla)' : 'sk-...';
  $('ai-key-clear').hidden = !apiKeySet;
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
    host = await resolveHost();
    $('mode-banner').hidden = false;
    chrome.runtime.sendMessage({ type: 'apply-ui' }).catch(() => {});
  }
}

// Ventana (y pestaña, si se conoce) desde la que se abrió el popup. Se prueban varias consultas
// porque según el navegador y el tipo de ventana alguna puede devolver vacío.
async function resolveHost() {
  const queries = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true },
    { active: true, windowType: 'normal' },
  ];
  for (const query of queries) {
    const [tab] = await chrome.tabs.query(query);
    if (tab) return { windowId: tab.windowId, tabId: tab.id };
  }
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  return { windowId: win?.id ?? chrome.windows.WINDOW_ID_CURRENT };
}

async function describeWindows() {
  const wins = await chrome.windows.getAll({ populate: true }).catch(() => []);
  return wins.map((win) => `${win.type}${win.incognito ? '/privada' : ''}${win.focused ? '*' : ''}:${win.tabs?.length ?? 0}`).join(' ') || 'ninguna';
}

// open() debe ser lo primero tras el clic: un await antes puede hacer perder el gesto del usuario,
// así que la ventana anfitriona se calcula al cargar, no al pulsar.
let host;

$('open-panel').addEventListener('click', async () => {
  const failure = async (err) => {
    console.error(err);
    $('mode-banner').querySelector('span').textContent = `No se pudo abrir el panel: ${err.message} · ventanas: ${await describeWindows()}`;
  };
  try {
    host ??= await resolveHost();
    await chrome.sidePanel.open({ windowId: host.windowId });
    window.close();
  } catch (windowError) {
    try {
      if (host.tabId === undefined) throw windowError;
      await chrome.sidePanel.open({ tabId: host.tabId });
      window.close();
    } catch {
      await failure(windowError);
    }
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

$('ai-enabled').addEventListener('change', async () => {
  settings = await saveSettings({ aiEnabled: $('ai-enabled').checked });
  await updateAiButtons();
  await autoClassify();
});
document.querySelectorAll('input[name="aiMode"]').forEach((radio) => {
  radio.addEventListener('change', async () => {
    settings = await saveSettings({ aiMode: radio.value });
    await updateAiButtons();
    await autoClassify();
  });
});
$('ai-key').addEventListener('change', async () => {
  const key = $('ai-key').value.trim();
  if (!key) return;
  await setApiKey(key);
  $('ai-key').value = '';
  apiKeySet = true;
  renderSettings();
  toast('Clave guardada en este navegador');
});
$('ai-key-clear').addEventListener('click', async () => {
  await setApiKey('');
  apiKeySet = false;
  renderSettings();
  await updateAiButtons();
  toast('Clave borrada');
});
$('ai-model').addEventListener('change', async () => {
  settings = await saveSettings({ aiModel: $('ai-model').value.trim() || 'gpt-6-luna' });
  renderSettings();
});
$('ai-limit').addEventListener('change', async () => {
  const limit = Math.max(0, Math.min(5000, Number($('ai-limit').value) || 0));
  settings = await saveSettings({ aiDailyLimit: limit });
  await renderAiStatus();
});

$('organize-bookmarks').addEventListener('change', async () => {
  settings = await saveSettings({ organizeBookmarks: $('organize-bookmarks').checked });
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
  if (changes.openaiKey) apiKeySet = !!(await getApiKey());
  if (changes.openaiKey || changes.settings) renderSettings();
  if (changes.aiStatus || changes.aiUsage || changes.settings) renderAiStatus();
  if (changes.aiProgress || changes.aiStatus) renderAiBanner();
  if (changes.saved || changes.settings || changes.classifications || changes.openaiKey) scheduleRefresh();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleRefresh();
});

// ---------- Inicio ----------

settings = await getSettings();
apiKeySet = !!(await getApiKey());
renderSettings();
await renderAiStatus();
await renderAiBanner();
await checkUiMode();
await updateSavedCount();
await loadTabs();
