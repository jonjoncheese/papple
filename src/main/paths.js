import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

export function statePath(app) {
  return join(app.getPath("userData"), "papple-state.json");
}

export function defaultSourcesDir() {
  return join(projectRoot, "papple-sources");
}

export const rendererDir = join(here, "..", "renderer");
