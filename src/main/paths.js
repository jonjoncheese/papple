import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

export function statePath(app) {
  return join(app.getPath("userData"), "papple-state.json");
}

// Dev: repo's papple-sources/. Packaged: Documents/PappleSources (writable, outside asar).
export function defaultSourcesDir(app) {
  if (app?.isPackaged) {
    return join(app.getPath("documents"), "PappleSources");
  }
  return join(projectRoot, "papple-sources");
}

export const rendererDir = join(here, "..", "renderer");
