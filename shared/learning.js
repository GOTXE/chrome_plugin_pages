// Memoria de las correcciones del usuario. No entrena nada: se guarda una lista corta de ejemplos
// (dominio, título y lo que el usuario eligió) que luego se usa de dos formas:
//   1. reglas de dominio aprendidas: clasifican sin enviar nada a OpenAI;
//   2. ejemplos que se añaden al prompt cuando sí hay que preguntar.
// Los ejemplos llevan el mismo tipo de dato que ya se envía (dominio y título, nunca la ruta).

const KEY = 'learned';
const MAX_EXAMPLES = 200;
const MIN_FOR_RULE = 3;  // correcciones mínimas de un dominio para que valga como regla
const RULE_SHARE = 0.8;  // proporción mínima que debe coincidir en la misma categoría
export const PROMPT_EXAMPLES = 24;

// Un ejemplo por URL: { key, domain, title, category?, action?, at }. Los más recientes primero.
export async function getExamples() {
  const { learned = [] } = await chrome.storage.local.get(KEY);
  return learned;
}

// Añade o actualiza ejemplos (lo nuevo manda sobre lo anterior de la misma URL) y conserva los más recientes.
export async function addExamples(list) {
  if (!list.length) return;
  const byKey = new Map((await getExamples()).map((example) => [example.key, example]));
  const now = Date.now();
  for (const item of list) byKey.set(item.key, { ...byKey.get(item.key), ...item, at: now });
  const merged = [...byKey.values()].sort((a, b) => b.at - a.at).slice(0, MAX_EXAMPLES);
  await chrome.storage.local.set({ [KEY]: merged });
}

export async function forgetExample(key) {
  await chrome.storage.local.set({ [KEY]: (await getExamples()).filter((example) => example.key !== key) });
}

// Olvidar una regla es olvidar la categoría de todos los ejemplos de ese dominio.
export async function forgetDomainRule(domain) {
  const kept = [];
  for (const example of await getExamples()) {
    if (example.domain !== domain || !example.category) {
      kept.push(example);
      continue;
    }
    const { category, ...rest } = example;
    if (rest.action) kept.push(rest);
  }
  await chrome.storage.local.set({ [KEY]: kept });
}

// Al borrar una categoría del usuario se olvida lo aprendido sobre ella.
export async function forgetCategory(categoryId) {
  const kept = [];
  for (const example of await getExamples()) {
    if (example.category !== categoryId) {
      kept.push(example);
      continue;
    }
    const { category, ...rest } = example;
    if (rest.action) kept.push(rest);
  }
  await chrome.storage.local.set({ [KEY]: kept });
}

export async function forgetAll() {
  await chrome.storage.local.remove(KEY);
}

// El valor que más se repite de `field` en la lista y si basta para formar una regla.
function dominant(list, field) {
  const counts = new Map();
  for (const example of list) counts.set(example[field], (counts.get(example[field]) ?? 0) + 1);
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { value, count, total: list.length, solid: count >= MIN_FOR_RULE && count / list.length >= RULE_SHARE };
}

// Dominios en los que el usuario ha corregido varias veces casi siempre a la misma categoría.
export function learnedRules(examples) {
  const rules = [];
  for (const [domain, list] of Map.groupBy(examples.filter((example) => example.category), (example) => example.domain)) {
    if (list.length < MIN_FOR_RULE) continue;
    const top = dominant(list, 'category');
    if (top.solid) rules.push({ domain, category: top.value, count: top.count, total: top.total });
  }
  return rules.sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

// Acción habitual del usuario con un dominio ('later' | 'keep'), o null si no hay base suficiente.
export function learnedAction(domain, examples) {
  const list = examples.filter((example) => example.domain === domain && example.action);
  if (list.length < MIN_FOR_RULE) return null;
  const top = dominant(list, 'action');
  return top.solid ? top.value : null;
}

// Ejemplos para el prompt: primero los de los dominios del lote, luego los más recientes.
export function pickExamples(items, examples, limit = PROMPT_EXAMPLES) {
  const domains = new Set(items.map((item) => item.domain));
  const sameDomain = examples.filter((example) => domains.has(example.domain)).slice(0, Math.ceil(limit / 2));
  const chosen = new Set(sameDomain);
  const recent = examples.filter((example) => !chosen.has(example)).slice(0, limit - sameDomain.length);
  return [...sameDomain, ...recent];
}
