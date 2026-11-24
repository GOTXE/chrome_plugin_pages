import { getSettings } from './shared/store.js';
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
  if (area === 'local' && (changes.saved || changes.settings)) requestSync();
});
chrome.runtime.onStartup.addListener(requestSync);
requestSync();

safeApply(); // cada vez que arranca el servicio, no solo en instalación o inicio
// La interfaz pide re-aplicar el modo (al cambiar el ajuste o si detecta que no coincide).
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'apply-ui') safeApply();
});
chrome.runtime.onInstalled.addListener(safeApply);
chrome.runtime.onStartup.addListener(safeApply);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) safeApply();
});
