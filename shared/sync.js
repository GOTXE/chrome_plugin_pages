import { domainOf, getSaved, getSettings, urlKey } from './store.js';

// Sincroniza la lista guardada con una carpeta de marcadores ("Leer luego"), que el
// navegador ya sincroniza entre dispositivos (Brave Sync / Chrome Sync).
//
// `syncedKeys` recuerda qué URL estaban ya en ambos lados en la última pasada. Con eso se
// distingue "nueva aquí" de "borrada en otro sitio": si una URL estaba sincronizada y falta
// en un lado, es que se borró en él.

const FOLDER_TITLE = 'Leer luego';
const SETTLE_MS = 500;

let queue = Promise.resolve();
let pending = false;

// Agrupa ráfagas de eventos en una sola pasada y las ejecuta de una en una.
export function requestSync() {
  if (pending) return queue;
  pending = true;
  queue = queue
    .then(async () => {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      pending = false;
      await run();
    })
    .catch((err) => {
      pending = false;
      console.error('Error al sincronizar con marcadores:', err);
    });
  return queue;
}

async function findFolder(create) {
  const [root] = await chrome.bookmarks.getTree();
  const other = root.children.find((node) => node.folderType === 'other') ?? root.children[1];
  const existing = other.children?.find((node) => !node.url && node.title === FOLDER_TITLE);
  if (existing || !create) return existing;
  return chrome.bookmarks.create({ parentId: other.id, title: FOLDER_TITLE });
}

async function run() {
  const settings = await getSettings();
  if (!settings.syncBookmarks) return;

  let folder = await findFolder(false);
  // Si la carpeta no existía no se sabe qué se borró: se vuelve a subir lo local sin borrar nada.
  const folderWasMissing = !folder;
  if (!folder) folder = await findFolder(true);

  const { syncedKeys = [] } = await chrome.storage.local.get('syncedKeys');
  const synced = folderWasMissing ? new Set() : new Set(syncedKeys);
  const saved = await getSaved();
  const children = await chrome.bookmarks.getChildren(folder.id);

  const marks = new Map();
  for (const node of children) {
    if (!/^https?:/i.test(node.url || '')) continue;
    const key = urlKey(node.url);
    if (marks.has(key)) await chrome.bookmarks.remove(node.id); // duplicado creado desde dos dispositivos
    else marks.set(key, node);
  }

  const local = new Map(saved.map((item) => [urlKey(item.url), item]));
  const inBoth = new Set();
  const drop = new Set();
  const imports = [];

  for (const [key, item] of local) {
    if (marks.has(key)) inBoth.add(key);
    else if (synced.has(key)) drop.add(key); // borrada en otro dispositivo
    else {
      await chrome.bookmarks.create({ parentId: folder.id, title: item.title, url: item.url });
      inBoth.add(key);
    }
  }

  for (const [key, node] of marks) {
    if (local.has(key)) continue;
    if (synced.has(key)) {
      await chrome.bookmarks.remove(node.id); // borrada aquí
    } else {
      imports.push({
        id: crypto.randomUUID(),
        url: node.url,
        title: node.title || node.url,
        favIconUrl: '',
        domain: domainOf(node.url),
        savedAt: node.dateAdded ?? Date.now(),
      });
      inBoth.add(key);
    }
  }

  if (drop.size || imports.length) {
    // Se relee la lista justo antes de escribir para no pisar un guardado que haya ocurrido mientras tanto.
    const fresh = await getSaved();
    const merged = [...imports, ...fresh.filter((item) => !drop.has(urlKey(item.url)))]
      .sort((a, b) => b.savedAt - a.savedAt);
    await chrome.storage.local.set({ saved: merged });
  }
  await chrome.storage.local.set({ syncedKeys: [...inBoth] });
}
