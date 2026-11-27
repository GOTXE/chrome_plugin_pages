import { categoryById, categoryFromFolderTitle, folderTitle } from './categories.js';
import { addExamples } from './learning.js';
import { domainOf, getClassifications, getSaved, getSettings, saveClassifications, urlKey } from './store.js';

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
      if (!node.url) {
        // Las subcarpetas de categoría se pasan tal cual; se unen después con las del mismo tipo.
        await chrome.bookmarks.move(node.id, { parentId: primary.id });
        continue;
      }
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

// Enlaces de la carpeta y de sus subcarpetas. `category` es la categoría de la subcarpeta en la
// que está (null si está suelto o en una subcarpeta que no es de categoría, que se respeta).
async function readTree(folderId) {
  const [tree] = await chrome.bookmarks.getSubTree(folderId);
  const entries = [];
  const subfolders = [];
  const walk = (node, category) => {
    for (const child of node.children ?? []) {
      if (child.url) {
        entries.push({ node: child, category });
        continue;
      }
      const found = categoryFromFolderTitle(child.title);
      if (node.id === folderId && found) subfolders.push({ node: child, category: found });
      walk(child, found?.id ?? category);
    }
  };
  walk(tree, null);
  return { entries, subfolders };
}

// Dos dispositivos pueden crear a la vez la subcarpeta del mismo tipo: se unen en la más antigua.
async function mergeCategoryFolders(subfolders) {
  const byCategory = Map.groupBy(subfolders, (sub) => sub.category.id);
  let changed = false;
  for (const group of byCategory.values()) {
    if (group.length < 2) continue;
    const [primary, ...extras] = [...group].sort((a, b) => (a.node.dateAdded ?? 0) - (b.node.dateAdded ?? 0));
    for (const extra of extras) {
      for (const child of await chrome.bookmarks.getChildren(extra.node.id)) {
        await chrome.bookmarks.move(child.id, { parentId: primary.node.id });
      }
      await chrome.bookmarks.removeTree(extra.node.id);
    }
    changed = true;
  }
  return changed;
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
  const organize = settings.organizeBookmarks;
  let tree = await readTree(folder.id);
  if (organize && (await mergeCategoryFolders(tree.subfolders))) tree = await readTree(folder.id);

  // Un mismo enlace puede aparecer en varias carpetas (p. ej. creado desde dos dispositivos):
  // se conserva uno, preferentemente el que ya está en una subcarpeta de categoría.
  const marks = new Map(); // clave de URL -> { node, category }
  const ordered = [...tree.entries].sort((a, b) => Number(!a.category) - Number(!b.category));
  for (const entry of ordered) {
    if (!/^https?:/i.test(entry.node.url || '')) continue;
    const key = urlKey(entry.node.url);
    if (marks.has(key)) await chrome.bookmarks.remove(entry.node.id);
    else marks.set(key, entry);
  }

  const categoryFolders = new Map(tree.subfolders.map((sub) => [sub.category.id, sub.node]));
  async function folderFor(categoryId) {
    if (!categoryFolders.has(categoryId)) {
      const created = await chrome.bookmarks.create({ parentId: folder.id, title: folderTitle(categoryById(categoryId)) });
      categoryFolders.set(categoryId, created);
    }
    return categoryFolders.get(categoryId);
  }
  const classifications = organize ? await getClassifications() : {};
  const placedNow = {}; // clave -> categoría de la subcarpeta en la que este equipo acaba de crear el marcador

  const local = new Map(saved.map((item) => [urlKey(item.url), item]));
  const inBoth = new Set();
  const drop = new Set();
  const imports = [];

  for (const [key, item] of local) {
    if (marks.has(key)) inBoth.add(key);
    else if (synced.has(key)) drop.add(key); // borrada en otro dispositivo
    else {
      // Si ya se conoce su categoría, el marcador nace en su subcarpeta.
      const category = organize ? classifications[key]?.category : null;
      const parent = category && categoryById(category) ? await folderFor(category) : folder;
      await chrome.bookmarks.create({ parentId: parent.id, title: item.title, url: item.url });
      if (parent !== folder) placedNow[key] = category;
      inBoth.add(key);
    }
  }

  for (const [key, { node }] of marks) {
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

  if (organize) await organizeByCategory(marks, folder, classifications, folderFor, placedNow);
}

// Manda la carpeta, no la IA: lo que ya está en una subcarpeta de categoría se adopta como su
// categoría (así las categorías viajan entre dispositivos) y no se mueve nunca. Solo se mueven los
// enlaces sueltos cuya categoría ya se conoce.
//
// `placed` recuerda en qué subcarpeta dejó o vio este equipo cada enlace. Si luego aparece en otra,
// es una corrección del usuario y se guarda como ejemplo para aprender. Si nunca lo habíamos visto
// colocado (llegó por Sync ya organizado), adoptar su carpeta no cuenta como corrección: no se puede
// saber si la puso el usuario o la IA de otro dispositivo, y no se quiere aprender de la propia IA.
async function organizeByCategory(marks, folder, classifications, folderFor, placedNow) {
  const patch = {};
  const corrections = [];
  const now = Date.now();

  for (const [key, { node, category }] of marks) {
    const cached = classifications[key];
    if (!category) {
      const known = cached?.category;
      if (known && categoryById(known) && node.parentId === folder.id) {
        await chrome.bookmarks.move(node.id, { parentId: (await folderFor(known)).id });
        patch[key] = { ...cached, placed: known };
      }
    } else if (cached?.placed === category) {
      continue; // sin cambios
    } else if (cached?.category === category) {
      patch[key] = { ...cached, placed: category }; // coincide con lo que sabíamos: solo se anota dónde está
    } else {
      const corrected = !!cached?.placed;
      patch[key] = { category, action: 'later', confidence: 1, at: now, source: corrected ? 'user' : 'sync', placed: category };
      if (corrected) corrections.push({ key, domain: domainOf(node.url), title: (node.title || '').slice(0, 140), category });
    }
  }
  for (const [key, category] of Object.entries(placedNow)) {
    patch[key] ??= { ...classifications[key], placed: category };
  }

  if (Object.keys(patch).length) await saveClassifications(patch);
  if (corrections.length) await addExamples(corrections);
}
