import { BrowserWindow, clipboard, shell, ipcMain } from "electron";
import { join } from "node:path";
import { rendererDir } from "./paths.js";
import { resolveHandoffSite } from "../core/providers/prompt-handoff.js";

const preload = join(rendererDir, "..", "main", "preload.cjs");

let handoffWin = null;
let pending = null; // { resolve, reject }

function closeHandoff() {
  if (handoffWin && !handoffWin.isDestroyed()) handoffWin.close();
  handoffWin = null;
}

function ensureHandoffIpc() {
  if (ensureHandoffIpc._done) return;
  ensureHandoffIpc._done = true;

  ipcMain.handle("papple:handoffSubmit", (_e, raw) => {
    if (!pending) return { ok: false, error: "no handoff in flight" };
    const text = String(raw ?? "").trim();
    if (!text) return { ok: false, error: "paste the AI's reply first" };
    const { resolve } = pending;
    pending = null;
    closeHandoff();
    resolve(text);
    return { ok: true };
  });

  ipcMain.handle("papple:handoffCancel", () => {
    if (pending) {
      const { reject } = pending;
      pending = null;
      reject(new Error("handoff cancelled — open Settings and try Generate again, or pick another AI mode"));
    }
    closeHandoff();
    return { ok: true };
  });

  ipcMain.handle("papple:handoffCopyAgain", (_e, prompt) => {
    clipboard.writeText(String(prompt ?? ""));
    return { ok: true };
  });
}

/**
 * Copy prompt → open the user's AI site → show paste-back window → resolve with reply text.
 */
export function runPromptHandoff(prompt, { siteId = "chatgpt" } = {}) {
  ensureHandoffIpc();
  const site = resolveHandoffSite(siteId);
  clipboard.writeText(prompt);
  shell.openExternal(site.url).catch(() => {});

  if (pending) {
    pending.reject(new Error("another handoff was already waiting — cancelled"));
    pending = null;
  }

  return new Promise((resolve, reject) => {
    pending = { resolve, reject };

    if (handoffWin && !handoffWin.isDestroyed()) handoffWin.close();
    handoffWin = new BrowserWindow({
      width: 560,
      height: 640,
      title: "Papple — paste your questions",
      resizable: true,
      webPreferences: { preload, sandbox: false }
    });
    handoffWin.on("closed", () => {
      handoffWin = null;
      if (pending) {
        const { reject: rej } = pending;
        pending = null;
        rej(new Error("handoff window closed — reopen Settings → Generate, or switch AI mode"));
      }
    });
    handoffWin.loadFile(join(rendererDir, "handoff.html"));
    handoffWin.webContents.on("did-finish-load", () => {
      if (handoffWin && !handoffWin.isDestroyed()) {
        handoffWin.webContents.send("papple:handoffStart", {
          siteId: site.id,
          siteLabel: site.label,
          siteUrl: site.url,
          prompt
        });
      }
    });
  });
}
