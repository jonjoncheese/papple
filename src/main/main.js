import { app, Tray, Menu, ipcMain, screen, shell, dialog } from "electron";
import { join } from "node:path";
import { loadState, saveState } from "../core/storage.js";
import { generateCombinedBatch } from "../core/engine.js";
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
import { createBuddyWindow, createPopupWindow, createSettingsWindow, createOnboardingWindow } from "./windows.js";

let buddyWin, popupWin, settingsWin, onboardingWin, tray;
let controller, statePathStr; // assigned in whenReady; used by module-level IPC handlers

// Kick off today's generation in the background and show a brewing/ready bubble.
function startGeneration() {
  if (!buddyWin || buddyWin.isDestroyed() || !controller) return;
  buddyWin.webContents.send("papple:genStatus", "brewing");
  controller.ensureTodayBatch()
    .then(() => { if (buddyWin && !buddyWin.isDestroyed()) buddyWin.webContents.send("papple:genStatus", "ready"); })
    .catch(() => { if (buddyWin && !buddyWin.isDestroyed()) buddyWin.webContents.send("papple:genStatus", "error"); });
}

function openOnboarding() {
  if (onboardingWin && !onboardingWin.isDestroyed()) { onboardingWin.focus(); return; }
  onboardingWin = createOnboardingWindow();
  onboardingWin.on("closed", () => { onboardingWin = null; });
}

ipcMain.on("papple:openSourcesFolder", async () => {
  const st = await loadState(statePath(app));
  shell.openPath(st.settings.sourcesDir || defaultSourcesDir());
});

ipcMain.handle("papple:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], title: "Choose your Papple sources folder" });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("papple:finishOnboarding", async (_e, opts = {}) => {
  const sp = statePath(app);
  const st = await loadState(sp);
  if (opts.folder) st.settings.sourcesDir = opts.folder;
  if (!st.settings.sourcesDir) st.settings.sourcesDir = defaultSourcesDir();
  st.settings.onboarded = true;
  await saveState(sp, st);
  if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.close();
  startGeneration();
  return true;
});

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

// The quiz window is created once and kept loaded; we just hide/show it so
// questions + progress persist between opens.
function ensurePopupWindow() {
  if (!popupWin || popupWin.isDestroyed()) {
    popupWin = createPopupWindow();
    popupWin.on("closed", () => { popupWin = null; });
  }
  return popupWin;
}

function openPopup() {
  const win = ensurePopupWindow();
  win.show();
  win.focus();
}

// Click Papple to toggle the quiz window — hides it (keeps it loaded), not destroys.
function togglePopup() {
  const win = ensurePopupWindow();
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
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

// --- grab / drag / throw ---
ipcMain.on("papple:dragMove", (_e, pos) => {
  if (buddyWin && !buddyWin.isDestroyed()) buddyWin.setPosition(Math.round(pos.x), Math.round(pos.y));
});

ipcMain.on("papple:savePos", async (_e, pos) => {
  const sp = statePath(app);
  const state = await loadState(sp);
  state.buddyPosition = { x: Math.round(pos.x), y: Math.round(pos.y) };
  await saveState(sp, state);
});

ipcMain.on("papple:throw", (_e, v) => throwAway(v.vx, v.vy));

// Fling Papple along the release velocity (with gravity) until off-screen, then hide to the tray.
function throwAway(vx, vy) {
  if (!buddyWin || buddyWin.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const b = buddyWin.getBounds();
  let x = b.x, y = b.y, dx = vx * 16, dy = vy * 16;
  const timer = setInterval(() => {
    if (!buddyWin || buddyWin.isDestroyed()) { clearInterval(timer); return; }
    dy += 2.4; x += dx; y += dy;
    buddyWin.setPosition(Math.round(x), Math.round(y));
    if (x < workArea.x - b.width - 60 || x > workArea.x + workArea.width + 60 || y > workArea.y + workArea.height + 60) {
      clearInterval(timer);
      buddyWin.hide();
    }
  }, 16);
}

// Bring Papple back (after a throw) to his saved/corner spot.
async function showPapple() {
  if (!buddyWin || buddyWin.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const b = buddyWin.getBounds();
  let x = workArea.x + workArea.width - b.width - 20, y = workArea.y + workArea.height - b.height - 20;
  const state = await loadState(statePath(app));
  if (state.buddyPosition && state.buddyPosition.x != null) {
    x = Math.min(Math.max(state.buddyPosition.x, workArea.x), workArea.x + workArea.width - b.width);
    y = Math.min(Math.max(state.buddyPosition.y, workArea.y), workArea.y + workArea.height - b.height);
  }
  buddyWin.setPosition(Math.round(x), Math.round(y));
  buddyWin.show();
}

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

  statePathStr = sp;
  controller = createController({
    loadState, saveState, statePath: sp,
    now: () => new Date(),
    // read the CURRENT sources folder each time (it can change via onboarding/settings)
    loadActiveDecks: async (activeDecks) => {
      const st = await loadState(sp);
      return loadActiveDecks(st.settings.sourcesDir || sourcesDir, activeDecks,
        { pdfParser: parsePdf, onSkip: (n, e) => console.warn("skip", n, e.message) });
    },
    buildProvider: (settings) => buildProvider(settings, { fetchImpl: globalThis.fetch }),
    generateCombinedBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  });

  registerIpc({ controller, statePathStr: sp, sourcesDir, openSettings, openPopup });

  buddyWin = createBuddyWindow();

  // Restore where the user last placed him.
  (async () => {
    const st = await loadState(sp);
    if (st.buddyPosition && st.buddyPosition.x != null && buddyWin && !buddyWin.isDestroyed()) {
      const { workArea } = screen.getPrimaryDisplay();
      const b = buddyWin.getBounds();
      const x = Math.min(Math.max(st.buddyPosition.x, workArea.x), workArea.x + workArea.width - b.width);
      const y = Math.min(Math.max(st.buddyPosition.y, workArea.y), workArea.y + workArea.height - b.height);
      buddyWin.setPosition(x, y);
    }
  })();

  // First run → onboarding; otherwise pre-generate today's questions right away.
  buddyWin.webContents.on("did-finish-load", async () => {
    if (buddyWin.isDestroyed()) return;
    const st = await loadState(sp);
    if (st.settings.onboarded) startGeneration();
    else openOnboarding();
  });

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
    { label: "Show Papple 🍍", click: showPapple },
    { label: "Settings", click: openSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]));
  tray.on("click", showPapple); // single-click the tray icon to bring him back
});

  app.on("window-all-closed", () => {}); // keep running in tray
}
