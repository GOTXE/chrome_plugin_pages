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

async function findFolders() {
  const [root] = await chrome.bookmarks.getTree();
  const other = root.children.find((node) => node.folderType === 'other') ?? root.children[1];
  const folders = (other.children ?? []).filter((node) => !node.url && node.title === FOLDER_TITLE);
  // Todos los dispositivos deben elegir la misma carpeta principal: la más antigua.
  folders.sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0));
  return { other, folders };
}

// Si hay varias carpetas "Leer luego" (p. ej. una creada en un dispositivo antes de que
// llegara la de otro), se pasan todos los enlaces a la principal y se borran las demás.
async function mergeFolders(folders) {
  const [primary, ...extras] = folders;
  if (!extras.length) return primary;

  const known = new Set();
  for (const node of await chrome.bookmarks.getChildren(primary.id)) {
    if (node.url) known.add(urlKey(node.url));
  }
  for (const extra of extras) {
    for (const node of await chrome.bookmarks.getChildren(extra.id)) {
      if (!node.url) continue;
      const key = urlKey(node.url);
      if (known.has(key)) await chrome.bookmarks.remove(node.id);
      else {
        known.add(key);
        await chrome.bookmarks.move(node.id, { parentId: primary.id });
      }
    }
    await chrome.bookmarks.removeTree(extra.id);
  }
  return primary;
}

async function run() {
  const settings = await getSettings();
  if (!settings.syncBookmarks) return;

  const saved = await getSaved();
  const { other, folders } = await findFolders();

  // La carpeta no se crea hasta que hay algo que subir: si se creara vacía al arrancar, y la
  // de otro dispositivo llegara después, quedarían dos.
  if (!folders.length && !saved.length) return;

  // Si la carpeta no existía no se sabe qué se borró: se vuelve a subir lo local sin borrar nada.
  const folderWasMissing = !folders.length;
  const folder = folders.length
    ? await mergeFolders(folders)
    : await chrome.bookmarks.create({ parentId: other.id, title: FOLDER_TITLE });

  const { syncedKeys = [] } = await chrome.storage.local.get('syncedKeys');
  const synced = folderWasMissing ? new Set() : new Set(syncedKeys);
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
