export const DEFAULTS = {
  uiMode: 'popup', // 'popup' | 'panel'
  idleDays: 3,
  syncBookmarks: true,
  keepDomains: [],
  laterDomains: [],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

export async function saveSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings });
  return settings;
}

export async function getSaved() {
  const { saved = [] } = await chrome.storage.local.get('saved');
  return saved;
}

// Añade las pestañas a la lista, sin duplicar por URL. Devuelve cuántas eran nuevas.
export async function addSaved(tabs) {
  const saved = await getSaved();
  const known = new Set(saved.map((item) => urlKey(item.url)));
  const now = Date.now();
  const fresh = [];
  for (const tab of tabs) {
    const key = urlKey(tab.url);
    if (known.has(key)) continue;
    known.add(key);
    fresh.push({
      id: crypto.randomUUID(),
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl || '',
      domain: domainOf(tab.url),
      savedAt: now,
    });
  }
  await chrome.storage.local.set({ saved: [...fresh, ...saved] });
  return fresh.length;
}

export async function removeSaved(ids) {
  const drop = new Set(ids);
  const saved = await getSaved();
  await chrome.storage.local.set({ saved: saved.filter((item) => !drop.has(item.id)) });
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|ref_src)$/i;

// Clave para comparar URLs: ignora protocolo, www, ancla, barra final y parámetros de rastreo.
export function urlKey(url) {
  try {
    const u = new URL(url);
    const params = [...u.searchParams]
      .filter(([name]) => !TRACKING_PARAMS.test(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join('&');
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.hostname.replace(/^www\./, '')}${path}${params ? `?${params}` : ''}`.toLowerCase();
  } catch {
    return url;
  }
}

export function normalizeDomain(text) {
  const value = text.trim().toLowerCase();
  if (!value) return '';
  return domainOf(value.includes('://') ? value : `https://${value}`);
}

function matches(domain, list) {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isSavable(tab) {
  return /^https?:/i.test(tab.url || '');
}

// Decide qué hacer con una pestaña según reglas simples. Devuelve { action, reason }.
export function classify(tab, settings, now = Date.now()) {
  if (!isSavable(tab)) return { action: 'keep', reason: 'página interna' };
  if (tab.pinned) return { action: 'keep', reason: 'anclada' };
  if (tab.groupId !== undefined && tab.groupId !== -1) return { action: 'keep', reason: 'en un grupo' };
  if (tab.audible) return { action: 'keep', reason: 'con audio' };
  if (tab.active) return { action: 'keep', reason: 'activa' };

  const domain = domainOf(tab.url);
  if (matches(domain, settings.keepDomains)) return { action: 'keep', reason: 'dominio protegido' };
  if (matches(domain, settings.laterDomains)) return { action: 'later', reason: 'dominio de lectura' };

  if (tab.lastAccessed) {
    const days = Math.floor((now - tab.lastAccessed) / DAY_MS);
    if (days >= settings.idleDays) return { action: 'later', reason: `sin abrir hace ${days} d` };
  }
  return { action: 'keep', reason: 'reciente' };
}

export function toMarkdown(items) {
  return items
    .map((item) => `- [${item.title.replace(/[\[\]]/g, '')}](${item.url}) — ${item.domain}, ${new Date(item.savedAt).toISOString().slice(0, 10)}`)
    .join('\n');
}
