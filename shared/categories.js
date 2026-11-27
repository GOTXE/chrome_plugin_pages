// Categorías por tipo de contenido. La IA elige una por URL; `hint` es lo que se le explica al
// modelo para que distinga el tipo de artículo, no solo la web. Más adelante la lista podrá
// ampliarla el usuario: por eso todo el código la recibe como dato y no la asume fija.
export const CATEGORIES = [
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

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoryById(id) {
  return BY_ID.get(id);
}
