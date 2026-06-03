const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("papple", {
  getNext: () => ipcRenderer.invoke("papple:getNext"),
  submitAnswer: (id, payload) => ipcRenderer.invoke("papple:submitAnswer", id, payload),
  getStatus: () => ipcRenderer.invoke("papple:getStatus"),
  getHint: (id) => ipcRenderer.invoke("papple:getHint", id),
  getSettings: () => ipcRenderer.invoke("papple:getSettings"),
  saveSettings: (s) => ipcRenderer.invoke("papple:saveSettings", s),
  listDecks: () => ipcRenderer.invoke("papple:listDecks"),
  openSettings: () => ipcRenderer.invoke("papple:openSettings"),
  openPopup: () => ipcRenderer.invoke("papple:openPopup"),
  togglePopup: () => ipcRenderer.send("papple:togglePopup"),
  runAway: () => ipcRenderer.send("papple:runAway"),
  setIgnore: (ignore) => ipcRenderer.send("papple:setIgnore", ignore),
  openSourcesFolder: () => ipcRenderer.send("papple:openSourcesFolder"),
  pickFolder: () => ipcRenderer.invoke("papple:pickFolder"),
  finishOnboarding: (opts) => ipcRenderer.invoke("papple:finishOnboarding", opts),
  dragMove: (pos) => ipcRenderer.send("papple:dragMove", pos),
  throwAway: (v) => ipcRenderer.send("papple:throw", v),
  savePos: (pos) => ipcRenderer.send("papple:savePos", pos),
  onGenStatus: (cb) => ipcRenderer.on("papple:genStatus", (_e, s) => cb(s)),
  onHydrate: (cb) => ipcRenderer.on("papple:hydrate", () => cb())
});
