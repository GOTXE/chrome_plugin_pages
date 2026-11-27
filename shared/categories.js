// Categorías por tipo de contenido. La IA elige una por URL; `hint` es lo que se le explica al
// modelo para que distinga el tipo de artículo, no solo la web. Las predefinidas no se pueden
// cambiar; el usuario puede añadir las suyas (storage.local → `customCategories`).
export const BUILTIN_CATEGORIES = [
  { id: 'blog', label: 'Blog y opinión', emoji: '✍️', hint: 'personal blog posts, essays, opinion pieces, newsletters' },
  { id: 'tecnologia', label: 'Tecnología', emoji: '💻', hint: 'technology, software, hardware or science articles and discussions' },
  { id: 'noticias', label: 'Noticias', emoji: '📰', hint: 'news reports and current-affairs articles' },
  { id: 'tutorial', label: 'Tutoriales y guías', emoji: '🧭', hint: 'step-by-step tutorials, how-to guides, courses' },
  { id: 'referencia', label: 'Referencia y documentación', emoji: '📚', hint: 'documentation, specs, wikis, API references, Q&A answers' },
  { id: 'trabajo', label: 'Trabajo', emoji: '💼', hint: 'work tools, dashboards, tickets, internal pages, mail, calendars' },
  { id: 'compras', label: 'Compras', emoji: '🛒', hint: 'products, stores, price comparisons, orders' },
  { id: 'video', label: 'Vídeo', emoji: '🎬', hint: 'videos, streams, podcasts' },
  { id: 'social', label: 'Redes sociales', emoji: '💬', hint: 'social network posts, threads, profiles, forums' },
  { id: 'otros', label: 'Otros', emoji: '📌', hint: 'anything that fits none of the above' },
];


// Lista vigente: las predefinidas más las del usuario. Se mantiene al día sola cuando cambian en
// storage; quien la necesite antes de que el contexto haya leído storage debe llamar a loadCategories().
let current = BUILTIN_CATEGORIES;

export const categories = () => current;

export async function getCustomCategories() {
  const { customCategories = [] } = await chrome.storage.local.get('customCategories');
  return customCategories;
}

export async function saveCustomCategories(list) {
  await chrome.storage.local.set({ customCategories: list });
}

export async function loadCategories() {
  const custom = (await getCustomCategories()).map((category) => ({
    ...category,
    custom: true,
    // Lo que se le explica al modelo: el nombre y, si la hay, la descripción del usuario.
    hint: category.description ? `${category.label}: ${category.description}` : category.label,
  }));
  current = [...BUILTIN_CATEGORIES, ...custom];
  return current;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.customCategories) loadCategories();
});

export function categoryById(id) {
  return current.find((category) => category.id === id);
}

// Nombre de la subcarpeta de marcadores de una categoría: "📰 Noticias".
export function folderTitle(category) {
  return `${category.emoji} ${category.label}`;
}

const nameOf = (title) => String(title).replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();

// Reconoce una subcarpeta por su nombre aunque se le haya quitado o cambiado el emoji.
export function categoryFromFolderTitle(title) {
  const name = nameOf(title);
  return current.find((category) => category.label.toLowerCase() === name);
}

// Separa el emoji inicial del nombre de una carpeta ("🍲 Cocina" → { emoji: "🍲", label: "Cocina" }).
export function parseFolderTitle(title) {
  const text = String(title).trim();
  const match = text.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u);
  return match ? { emoji: match[1], label: match[2].trim() || text } : { emoji: '📁', label: text };
}

// Un nombre es válido si no está vacío, no es excesivo y no coincide con otra categoría.
export function validateLabel(label, ignoreId = null) {
  const name = label.trim();
  if (!name) return 'Escribe un nombre.';
  if (name.length > 40) return 'El nombre es demasiado largo (máximo 40 caracteres).';
  if (current.some((category) => category.id !== ignoreId && category.label.toLowerCase() === name.toLowerCase())) {
    return 'Ya existe una categoría con ese nombre.';
  }
  return null;
}
