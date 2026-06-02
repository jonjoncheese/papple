import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { rendererDir } from "./paths.js";

const preload = join(rendererDir, "..", "main", "preload.cjs");

export function createBuddyWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const w = 220, h = 240;
  const win = new BrowserWindow({
    width: w, height: h,
    x: workArea.x + workArea.width - w - 20,
    y: workArea.y + workArea.height - h - 20,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: false, title: "Papple",
    webPreferences: { preload, sandbox: false }
  });
  win.setAlwaysOnTop(true, "screen-saver"); // stay above normal windows
  win.loadFile(join(rendererDir, "buddy.html"));
  return win;
}

export function createPopupWindow() {
  const win = new BrowserWindow({
    width: 380, height: 460, frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, skipTaskbar: true,
    webPreferences: { preload, sandbox: false }
  });
  win.loadFile(join(rendererDir, "popup.html"));
  return win;
}

export function createSettingsWindow() {
  const win = new BrowserWindow({
    width: 460, height: 560, title: "Papple Settings",
    webPreferences: { preload, sandbox: false }
  });
  win.loadFile(join(rendererDir, "settings.html"));
  return win;
}
