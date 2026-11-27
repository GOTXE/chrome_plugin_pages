import { classifyUrls } from './shared/ai.js';
import { getSaved, getSettings } from './shared/store.js';
import { requestSync } from './shared/sync.js';

const POPUP_PATH = 'app/app.html?mode=popup';
// El panel va declarado también en el manifest: lo que se fija con setOptions no sobrevive a
// un reinicio del navegador, y sin panel registrado sidePanel.open() falla con "No active side panel".
// La interfaz asume modo panel cuando no recibe ?mode=popup.
const PANEL_PATH = 'app/app.html';

// Alterna entre popup y panel lateral según el ajuste del usuario.
async function applyUiMode() {
  const { uiMode } = await getSettings();
  const panel = chrome.sidePanel;

  if (uiMode === 'panel' && panel) {
    await panel.setOptions({ path: PANEL_PATH, enabled: true });
    await chrome.action.setPopup({ popup: '' });
    await panel.setPanelBehavior({ openPanelOnActionClick: true });
  } else {
    await chrome.action.setPopup({ popup: POPUP_PATH });
    if (panel) {
      await panel.setOptions({ path: PANEL_PATH, enabled: true });
      await panel.setPanelBehavior({ openPanelOnActionClick: false });
    }
  }
}

async function safeApply() {
  try {
    await applyUiMode();
  } catch (err) {
    console.error('No se pudo aplicar el modo de interfaz:', err);
  }
}

// Respaldo: solo se dispara si el icono se pulsa sin popup ni comportamiento de panel aplicados.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const { uiMode } = await getSettings();
    if (uiMode === 'panel' && chrome.sidePanel) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      await applyUiMode();
      await chrome.action.openPopup();
    }
  } catch (err) {
    console.error('No se pudo abrir la interfaz:', err);
  }
});

// Sincronización con marcadores: cambios locales, cambios que llegan de otros dispositivos y ajustes.
for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onImportEnded']) {
  chrome.bookmarks[name].addListener(requestSync);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.saved || changes.settings || changes.classifications)) requestSync();
});
chrome.runtime.onStartup.addListener(requestSync);
requestSync();

safeApply(); // cada vez que arranca el servicio, no solo en instalación o inicio
// Clasificación con IA. La ejecuta el servicio, no el popup, para que no se corte si este se cierra.
async function runClassification(entries) {
  try {
    return await classifyUrls(entries);
  } catch (err) {
    console.error('Clasificación con IA:', err);
    return { error: err.message };
  }
}

// Modo automático: cada URL nueva que entra en guardadas (también las que llegan por Sync).
let autoTimer;
function scheduleAutoClassify() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(async () => {
    const settings = await getSettings();
    if (!settings.aiEnabled || settings.aiMode !== 'auto') return;
    const saved = await getSaved();
    await runClassification(saved.map((item) => ({ url: item.url, title: item.title })));
  }, 1500);
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.saved) scheduleAutoClassify();
});
chrome.runtime.onStartup.addListener(scheduleAutoClassify);

// Insignia del icono: "…" mientras clasifica y "!" si falló, para que se vea aunque el popup esté cerrado.
async function updateBadge() {
  const { aiProgress, aiStatus } = await chrome.storage.local.get(['aiProgress', 'aiStatus']);
  const running = aiProgress?.running && Date.now() - aiProgress.startedAt < 5 * 60_000;
  const failed = aiStatus && !aiStatus.ok && !aiStatus.dismissed;
  await chrome.action.setBadgeText({ text: running ? '…' : failed ? '!' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: running ? '#5b8def' : '#d93025' });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.aiProgress || changes.aiStatus)) updateBadge().catch(console.error);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // La interfaz pide re-aplicar el modo (al cambiar el ajuste o si detecta que no coincide).
  if (message?.type === 'apply-ui') {
    safeApply();
    return false;
  }
  if (message?.type === 'classify' && Array.isArray(message.entries)) {
    runClassification(message.entries).then(sendResponse);
    return true; // respuesta asíncrona
  }
  return false;
});
chrome.runtime.onInstalled.addListener(safeApply);
chrome.runtime.onStartup.addListener(safeApply);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) safeApply();
});
