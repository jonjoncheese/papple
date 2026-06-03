import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function defaultState() {
  return {
    settings: {
      onboarded: false,
      activeDecks: [],
      answerMode: "both",
      pace: "session",
      nudgeIntervalMin: 90,
      questionsPerDay: 10,
      endlessMode: true,
      theme: "dark",
      quietStartHour: 22,
      quietEndHour: 7,
      hydration: { enabled: true, intervalMin: 90 },
      aiMode: "claude-code",
      apiKey: "",
      apiModel: "",
      sourcesDir: ""
    },
    streak: { count: 0, lastCompletedDate: null },
    dailyScores: {},
    topicStats: {},
    today: { date: null, batch: [], progress: {} },
    buddyPosition: { x: null, y: null }
  };
}

// shallow-deep merge: fills missing keys (incl. nested objects) from defaults
function mergeDefaults(target, defaults) {
  const out = Array.isArray(defaults) ? (target ?? defaults) : { ...defaults };
  if (Array.isArray(defaults)) return target ?? defaults;
  for (const k of Object.keys(defaults)) {
    if (defaults[k] && typeof defaults[k] === "object" && !Array.isArray(defaults[k])) {
      out[k] = mergeDefaults(target?.[k] ?? {}, defaults[k]);
    } else if (target && k in target) {
      out[k] = target[k];
    }
  }
  // keep any extra keys present in target
  if (target && typeof target === "object") {
    for (const k of Object.keys(target)) if (!(k in out)) out[k] = target[k];
  }
  return out;
}

export async function loadState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return mergeDefaults(JSON.parse(raw), defaultState());
  } catch (err) {
    if (err.code === "ENOENT") return defaultState();
    throw err;
  }
}

export async function saveState(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}
