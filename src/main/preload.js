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
  onHydrate: (cb) => ipcRenderer.on("papple:hydrate", () => cb())
});
