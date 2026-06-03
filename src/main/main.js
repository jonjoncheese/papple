import { app, Tray, Menu, ipcMain, screen } from "electron";
import { join } from "node:path";
import { loadState, saveState } from "../core/storage.js";
import { generateDailyBatch } from "../core/engine.js";
import { gradeMc } from "../core/grader.js";
import { recordCompletion } from "../core/streak.js";
import { recordAnswer } from "../core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../core/scheduler.js";
import { createController } from "./app-controller.js";
import { buildProvider } from "./provider-factory.js";
import { loadActiveDecks } from "./decks-loader.js";
import { parsePdf } from "./pdf.js";
import { statePath, defaultSourcesDir, rendererDir } from "./paths.js";
import { registerIpc } from "./ipc.js";
import { createBuddyWindow, createPopupWindow, createSettingsWindow } from "./windows.js";

let buddyWin, popupWin, settingsWin, tray;

async function ensureSourcesDir() {
  const sp = statePath(app);
  const state = await loadState(sp);
  if (!state.settings.sourcesDir) {
    state.settings.sourcesDir = defaultSourcesDir();
    await saveState(sp, state);
  }
  return state.settings.sourcesDir;
}

// Toggle the buddy window's click-through: solid only while the cursor is over
// Papple himself, so the transparent corner never blocks the rest of the screen.
ipcMain.on("papple:setIgnore", (_e, ignore) => {
  if (buddyWin && !buddyWin.isDestroyed()) buddyWin.setIgnoreMouseEvents(ignore, { forward: true });
});

function openPopup() {
  // Always recreate fresh — avoids the transparent-window glitch where it
  // won't repaint after losing focus.
  if (popupWin && !popupWin.isDestroyed()) popupWin.destroy();
  popupWin = createPopupWindow();
  popupWin.on("closed", () => { popupWin = null; });
}

// Click Papple to toggle the quiz window open/closed.
function togglePopup() {
  if (popupWin && !popupWin.isDestroyed()) { popupWin.destroy(); popupWin = null; return; }
  openPopup();
}

// Papple dashes across the screen and scurries home (10-rapid-clicks easter egg).
function runAway() {
  if (!buddyWin || buddyWin.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const b = buddyWin.getBounds();
  const homeX = workArea.x + workArea.width - b.width - 20;
  const homeY = workArea.y + workArea.height - b.height - 20;
  let t = 0;
  const timer = setInterval(() => {
    if (!buddyWin || buddyWin.isDestroyed()) { clearInterval(timer); return; }
    t += 0.05;
    if (t >= 1) { clearInterval(timer); buddyWin.setPosition(homeX, homeY); return; }
    const x = Math.round(homeX - Math.sin(t * Math.PI) * workArea.width * 0.75);
    const y = Math.round(homeY - Math.abs(Math.sin(t * Math.PI * 3)) * 60);
    buddyWin.setPosition(x, y);
  }, 25);
}

ipcMain.on("papple:togglePopup", togglePopup);
ipcMain.on("papple:runAway", runAway);

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = createSettingsWindow();
  settingsWin.on("closed", () => { settingsWin = null; });
}

// Single-instance: a second `npm start` focuses the existing Papple instead of
// spawning another Electron process.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (buddyWin && !buddyWin.isDestroyed()) {
      if (buddyWin.isMinimized()) buddyWin.restore();
      buddyWin.show();
      buddyWin.focus();
    }
  });

app.whenReady().then(async () => {
  const sp = statePath(app);
  const sourcesDir = await ensureSourcesDir();

  const controller = createController({
    loadState, saveState, statePath: sp,
    now: () => new Date(),
    loadActiveDecks: (activeDecks) =>
      loadActiveDecks(sourcesDir, activeDecks, { pdfParser: parsePdf, onSkip: (n, e) => console.warn("skip", n, e.message) }),
    buildProvider: (settings) => buildProvider(settings, { fetchImpl: globalThis.fetch }),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  });

  registerIpc({ controller, statePathStr: sp, sourcesDir, openSettings, openPopup });

  buddyWin = createBuddyWindow();

  setInterval(async () => {
    if (await controller.hydrationDue()) {
      await controller.markHydrated();
      if (buddyWin && !buddyWin.isDestroyed()) buddyWin.webContents.send("papple:hydrate");
    }
  }, 5 * 60_000);

  tray = new Tray(join(rendererDir, "tray.png"));
  tray.setToolTip("Papple");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Quiz me now", click: openPopup },
    { label: "Settings", click: openSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]));
});

  app.on("window-all-closed", () => {}); // keep running in tray
}
