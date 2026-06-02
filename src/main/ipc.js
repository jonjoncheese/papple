import { ipcMain } from "electron";
import { loadState, saveState } from "../core/storage.js";
import { listDeckDirs } from "../core/decks.js";

export function registerIpc({ controller, statePathStr, sourcesDir, openSettings, openPopup }) {
  ipcMain.handle("papple:getNext", () => controller.getNext());
  ipcMain.handle("papple:submitAnswer", (_e, id, payload) => controller.submitAnswer(id, payload));
  ipcMain.handle("papple:getStatus", () => controller.getStatus());
  ipcMain.handle("papple:getHint", (_e, id) => controller.getHint(id));
  ipcMain.handle("papple:listDecks", () => listDeckDirs(sourcesDir));
  ipcMain.handle("papple:getSettings", async () => (await loadState(statePathStr)).settings);
  ipcMain.handle("papple:saveSettings", async (_e, newSettings) => {
    const state = await loadState(statePathStr);
    state.settings = { ...state.settings, ...newSettings };
    await saveState(statePathStr, state);
    return state.settings;
  });
  ipcMain.handle("papple:openSettings", () => { openSettings(); });
  ipcMain.handle("papple:openPopup", () => { openPopup(); });
}
