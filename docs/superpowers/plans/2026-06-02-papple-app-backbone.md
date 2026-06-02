# Papple App Backbone — Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tested core engine into a runnable Electron app: an always-on-top corner buddy you click to get your daily questions, with real generation/grading/streak tracking, a settings window, and hydration timing — functional and end-to-end, intentionally minimally styled.

**Architecture:** A testable `app-controller` orchestrates the (already-tested) core modules — it decides today's batch, grades answers, updates streak/score/topic stats, persists state, and answers "is hydration due?". Electron's main process builds the real dependencies (userData state file, real `pdf-parse`, real `fetch`, the chosen AI provider) and exposes the controller to renderer windows over a small `contextBridge` IPC surface. Renderer windows (buddy / popup / settings) are plain HTML/JS that call that surface.

**Tech Stack:** Electron (main + preload + renderer), the existing `src/core/` ESM modules, Node built-in test runner for the new testable units, `pdf-parse` for real PDF text.

**Scope:** Plan 2 of 4. Produces a working but un-styled app. Plan 3 = pixel-art sprite + animations + full personality polish + extras (drag/sleep/idle-chatter/hint UI), designed in the visual companion. Plan 4 = packaging + showcase.

**Prerequisite:** Plan 1 complete (core engine on `master`, 60 tests green).

---

## File Structure

```
papple/
├─ package.json                 # + electron dep, "start" + "test" scripts, main entry
├─ src/
│  ├─ core/                     # (Plan 1 — unchanged, imported by main)
│  └─ main/
│     ├─ main.js                # Electron entry: windows, tray, IPC wiring, tick timer
│     ├─ windows.js             # create buddy/popup/settings BrowserWindows
│     ├─ preload.js             # contextBridge -> window.papple.* IPC surface
│     ├─ ipc.js                 # ipcMain handlers -> controller methods
│     ├─ paths.js               # state file path + default sources dir
│     ├─ pdf.js                 # real pdf-parse wrapper (the injected pdfParser)
│     ├─ decks-loader.js        # compose core list/load/resolve -> active decks
│     ├─ provider-factory.js    # settings -> Claude or Ollama provider
│     ├─ personality.js         # in-character lines + moods (pure)
│     └─ app-controller.js      # orchestrator (pure logic over injected deps)
│  └─ renderer/
│     ├─ buddy.html / buddy.js / buddy.css
│     ├─ popup.html / popup.js / popup.css
│     └─ settings.html / settings.js / settings.css
└─ test/main/                   # tests for the testable main-process units
```

**Testable (TDD):** `provider-factory`, `personality`, `decks-loader`, `app-controller`.
**Manual-verify (complete code, no unit tests):** `main.js`, `windows.js`, `preload.js`, `ipc.js`, `paths.js`, `pdf.js`, and the three renderer screens.

**Controller dependency contract (shared by all controller tasks):**
```js
createController({
  loadState, saveState, statePath,   // storage.js + path string
  now,                               // () => Date   (injected clock)
  loadActiveDecks,                   // (activeDecks:string[]) => Promise<[{deck,mode,text}]>
  buildProvider,                     // (settings) => { generateQuestions, gradeTyped, hint }
  generateDailyBatch,                // engine.js
  gradeMc,                           // grader.js
  recordCompletion,                  // streak.js
  recordAnswer,                      // topics.js
  isHydrationDue, isQuietHours, nextUnanswered  // scheduler.js
})
```
Returns `{ ensureTodayBatch, getNext, submitAnswer, hydrationDue, getStatus, getHint }`.

---

### Task 1: Add Electron + app scripts + boot window

**Files:**
- Modify: `package.json`
- Create: `src/main/main.js` (temporary boot version, replaced in Task 8)
- Create: `src/renderer/buddy.html` (temporary boot version, replaced in Task 9)

- [ ] **Step 1: Install Electron as a dev dependency**

Run: `npm install --save-dev electron`
Expected: electron added to `devDependencies` (download is ~100MB, may take a minute).

- [ ] **Step 2: Update `package.json`** — add the `main` entry and a `start` script (keep the existing `test` script and `pdf-parse` dependency):

```json
{
  "name": "papple",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/main/main.js",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\"",
    "start": "electron ."
  }
}
```
(Leave `dependencies` and `devDependencies` as npm wrote them.)

- [ ] **Step 3: Write a minimal boot `src/main/main.js`** (proves Electron launches; replaced in Task 8):

```js
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({ width: 300, height: 300 });
  win.loadFile(join(__dirname, "../renderer/buddy.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
```

- [ ] **Step 4: Write a minimal boot `src/renderer/buddy.html`** (replaced in Task 9):

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Papple</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:40px">
  <div style="font-size:64px">🍍</div>
  <p>Papple is booting…</p>
</body></html>
```

- [ ] **Step 5: Verify the app launches**

Run: `npm start`
Expected: a 300×300 window opens showing a 🍍 and "Papple is booting…". Close it.
(If Electron complains about ESM `main`, confirm `"type": "module"` is set and the import paths above are exact.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main/main.js src/renderer/buddy.html
git commit -m "feat(app): electron bootstrap window"
```

---

### Task 2: Provider factory

**Files:**
- Create: `src/main/provider-factory.js`
- Test: `test/main/provider-factory.test.js`

- [ ] **Step 1: Write the failing test** `test/main/provider-factory.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProvider } from "../../src/main/provider-factory.js";

const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: "[]" }], response: "[]" }) });

test("aiMode 'claude' builds a provider that hits the Anthropic endpoint", async () => {
  let calledUrl = "";
  const fi = async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ content: [{ text: "[]" }] }) }; };
  const p = buildProvider({ aiMode: "claude", apiKey: "k", claudeModel: "claude-haiku-4-5-20251001" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(calledUrl.includes("api.anthropic.com"));
});

test("aiMode 'ollama' builds a provider that hits the local Ollama endpoint", async () => {
  let calledUrl = "";
  const fi = async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ response: "[]" }) }; };
  const p = buildProvider({ aiMode: "ollama", ollamaModel: "llama3.2" }, { fetchImpl: fi });
  await p.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" });
  assert.ok(calledUrl.includes("11434"));
});

test("unknown aiMode throws", () => {
  assert.throws(() => buildProvider({ aiMode: "nope" }, { fetchImpl }), /unknown ai mode/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `provider-factory.js`.

- [ ] **Step 3: Implement `src/main/provider-factory.js`**

```js
import { createClaudeProvider } from "../core/providers/claude.js";
import { createOllamaProvider } from "../core/providers/ollama.js";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export function buildProvider(settings, { fetchImpl = globalThis.fetch } = {}) {
  if (settings.aiMode === "claude") {
    return createClaudeProvider({
      apiKey: settings.apiKey,
      model: settings.claudeModel || DEFAULT_CLAUDE_MODEL,
      fetchImpl
    });
  }
  if (settings.aiMode === "ollama") {
    return createOllamaProvider({
      model: settings.ollamaModel || "llama3.2",
      fetchImpl
    });
  }
  throw new Error(`unknown ai mode: ${settings.aiMode}`);
}
```

Note: the storage default uses `ollamaModel`; this adds an optional `claudeModel` setting (defaulted here). The Settings UI (Task 11) exposes both.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: provider-factory tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/provider-factory.js test/main/provider-factory.test.js
git commit -m "feat(app): provider factory (claude/ollama from settings)"
```

---

### Task 3: Personality engine

**Files:**
- Create: `src/main/personality.js`
- Test: `test/main/personality.test.js`

- [ ] **Step 1: Write the failing test** `test/main/personality.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pappleLine, moodFor, EVENTS } from "../../src/main/personality.js";

test("every known event returns a face + non-empty text", () => {
  for (const ev of EVENTS) {
    const line = pappleLine(ev, () => 0);
    assert.equal(typeof line.face, "string");
    assert.ok(line.text.length > 0, `empty text for ${ev}`);
  }
});

test("unknown event falls back to a neutral line, never throws", () => {
  const line = pappleLine("does-not-exist", () => 0);
  assert.ok(line.text.length > 0);
});

test("correct-answer line rotates with the rng", () => {
  const a = pappleLine("correct", () => 0).text;
  const b = pappleLine("correct", () => 0.99).text;
  assert.notEqual(a, b);
});

test("moodFor: alive streak + good score = happy", () => {
  assert.equal(moodFor({ streakAlive: true, recentScoreRate: 0.9 }), "happy");
});

test("moodFor: missed day = sad", () => {
  assert.equal(moodFor({ streakAlive: false, recentScoreRate: 0.9 }), "sad");
});

test("moodFor: alive but low score = neutral", () => {
  assert.equal(moodFor({ streakAlive: true, recentScoreRate: 0.3 }), "neutral");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `personality.js`.

- [ ] **Step 3: Implement `src/main/personality.js`**

```js
// Each entry: { face, lines: [string,...] }. `pappleLine` picks a line (rng-rotated).
const VOICE = {
  generating:   { face: "spinny", lines: ["brewing your questions… hang tight 🍍"] },
  unreachable:  { face: "spinny", lines: ["my brain's buffering… (can't reach Claude / local AI — check internet or your key in Settings)"] },
  noKey:        { face: "blank",  lines: ["I need a brain to think! Paste your Claude key in Settings 🔑"] },
  pdfFail:      { face: "squint", lines: ["I can't read that file — looks like a scanned image. Save it as a text PDF or drop a .md and I'll get it!"] },
  emptySources: { face: "hungry", lines: ["feed me notes! Drop PDFs in your papple-sources folder 🍍"] },
  ollamaDown:   { face: "hardhat",lines: ["local-brain mode needs Ollama running — start it, or switch me to Claude in Settings"] },
  correct:      { face: "happy",  lines: ["Yesss! 🍍✨", "nailed it!", "ooh you *know* this"] },
  wrong:        { face: "droop",  lines: ["aw, so close! here's the trick:"] },
  perfect:      { face: "party",  lines: ["PERFECT. I'm so proud I could sprout 🎉"] },
  streak:       { face: "party",  lines: ["🔥 streak going strong — you're unstoppable"] },
  missedDay:    { face: "wilt",   lines: ["I missed you yesterday… let's get back to it 🥺"] },
  idle:         { face: "peek",   lines: ["psst… questions waiting 👀", "I'm right here whenever you're ready 🍍"] },
  hydrate:      { face: "happy",  lines: ["sip some water 🥤", "quick stretch? your brain will thank you"] },
  sleep:        { face: "sleep",  lines: ["💤"] },
  done:         { face: "happy",  lines: ["that's all 10 — nice work today! 🍍"] }
};

export const EVENTS = Object.keys(VOICE);

export function pappleLine(event, rng = Math.random) {
  const entry = VOICE[event] ?? { face: "neutral", lines: ["…"] };
  const idx = Math.min(entry.lines.length - 1, Math.floor(rng() * entry.lines.length));
  return { face: entry.face, text: entry.lines[idx] };
}

export function moodFor({ streakAlive, recentScoreRate }) {
  if (!streakAlive) return "sad";
  if (recentScoreRate >= 0.6) return "happy";
  return "neutral";
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: personality tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/personality.js test/main/personality.test.js
git commit -m "feat(app): personality engine (lines + moods)"
```

---

### Task 4: Deck loader (compose core into active decks)

**Files:**
- Create: `src/main/decks-loader.js`
- Test: `test/main/decks-loader.test.js`

- [ ] **Step 1: Write the failing test** `test/main/decks-loader.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadActiveDecks } from "../../src/main/decks-loader.js";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "papsrc-"));
  await mkdir(join(dir, "withfiles"));
  await writeFile(join(dir, "withfiles", "n.md"), "real notes here");
  await mkdir(join(dir, "empty"));
  return dir;
}

test("returns one resolved deck per directory, files vs bank", async () => {
  const dir = await fixture();
  const decks = await loadActiveDecks(dir, [], { pdfParser: async () => ({ text: "" }) });
  const byName = Object.fromEntries(decks.map(d => [d.deck, d]));
  assert.equal(byName.withfiles.mode, "files");
  assert.ok(byName.withfiles.text.includes("real notes"));
  assert.equal(byName.empty.mode, "bank");
  await rm(dir, { recursive: true, force: true });
});

test("active filter limits which decks load", async () => {
  const dir = await fixture();
  const decks = await loadActiveDecks(dir, ["empty"], { pdfParser: async () => ({ text: "" }) });
  assert.deepEqual(decks.map(d => d.deck), ["empty"]);
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `decks-loader.js`.

- [ ] **Step 3: Implement `src/main/decks-loader.js`**

```js
import { join } from "node:path";
import { listDeckDirs, activeDeckDirs, resolveDeckText } from "../core/decks.js";
import { loadDeckFiles } from "../core/sources.js";

export async function loadActiveDecks(sourcesDir, activeDecks, { pdfParser, onSkip = () => {} } = {}) {
  const all = await listDeckDirs(sourcesDir);
  const active = activeDeckDirs(all, activeDecks);
  const out = [];
  for (const name of active) {
    const files = await loadDeckFiles(join(sourcesDir, name), { pdfParser, onSkip });
    out.push(resolveDeckText(name, files));
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: decks-loader tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/decks-loader.js test/main/decks-loader.test.js
git commit -m "feat(app): active-deck loader"
```

---

### Task 5: App controller — ensureTodayBatch + getNext

**Files:**
- Create: `src/main/app-controller.js`
- Test: `test/main/app-controller-batch.test.js`

- [ ] **Step 1: Write the failing test** `test/main/app-controller-batch.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";
import { generateDailyBatch } from "../../src/core/engine.js";
import { gradeMc } from "../../src/core/grader.js";
import { recordCompletion } from "../../src/core/streak.js";
import { recordAnswer } from "../../src/core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../../src/core/scheduler.js";
import { createController } from "../../src/main/app-controller.js";

function makeDeps(overrides = {}) {
  return {
    loadState, saveState, statePath: overrides.statePath,
    now: overrides.now ?? (() => new Date("2026-06-02T12:00:00")),
    loadActiveDecks: overrides.loadActiveDecks ?? (async () => [{ deck: "d", mode: "bank", text: "" }]),
    buildProvider: overrides.buildProvider ?? (() => ({
      async generateQuestions({ deckName, count }) {
        return JSON.stringify(Array.from({ length: count }, (_, i) => ({
          id: `${deckName}-${i}`, deck: deckName, topic: "T", source: "bank",
          type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0, explanation: "e"
        })));
      },
      async gradeTyped() { return { correct: true, feedback: "ok" }; },
      async hint() { return "hint"; }
    })),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

async function tmpStatePath() {
  const dir = await mkdtemp(join(tmpdir(), "papctl-"));
  return { path: join(dir, "state.json"), dir };
}

test("ensureTodayBatch generates and caches a batch for today", async () => {
  const { path, dir } = await tmpStatePath();
  const s = defaultState(); s.settings.questionsPerDay = 5;
  await saveState(path, s);
  const ctl = createController(makeDeps({ statePath: path }));
  const today = await ctl.ensureTodayBatch();
  assert.equal(today.batch.length, 5);
  assert.equal(today.date, "2026-06-02");
  // second call reuses cache (does not regenerate)
  let calls = 0;
  const ctl2 = createController(makeDeps({
    statePath: path,
    buildProvider: () => ({ async generateQuestions() { calls++; return "[]"; } })
  }));
  await ctl2.ensureTodayBatch();
  assert.equal(calls, 0);
  await rm(dir, { recursive: true, force: true });
});

test("getNext returns the first unanswered question", async () => {
  const { path, dir } = await tmpStatePath();
  await saveState(path, defaultState());
  const ctl = createController(makeDeps({ statePath: path }));
  const q = await ctl.getNext();
  assert.ok(q && q.id);
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `app-controller.js`.

- [ ] **Step 3: Implement `src/main/app-controller.js`** (this version covers Task 5; Tasks 6–7 append methods)

```js
function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createController(deps) {
  const {
    loadState, saveState, statePath, now,
    loadActiveDecks, buildProvider, generateDailyBatch,
    gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  } = deps;

  async function ensureTodayBatch() {
    const state = await loadState(statePath);
    const today = isoDay(now());
    if (state.today.date === today && state.today.batch.length > 0) {
      return state.today;
    }
    const decks = await loadActiveDecks(state.settings.activeDecks);
    const provider = buildProvider(state.settings);
    const batch = await generateDailyBatch({
      decks, provider,
      count: state.settings.questionsPerDay,
      topicStats: state.topicStats,
      answerMode: state.settings.answerMode
    });
    state.today = { date: today, batch, progress: {} };
    await saveState(statePath, state);
    return state.today;
  }

  async function getNext() {
    const today = await ensureTodayBatch();
    return nextUnanswered(today.batch, today.progress);
  }

  return {
    ensureTodayBatch,
    getNext,
    // submitAnswer, hydrationDue, getStatus, getHint added in Tasks 6-7
    _internals: { isoDay, loadState, saveState, statePath, now, buildProvider,
                  gradeMc, recordCompletion, recordAnswer,
                  isHydrationDue, isQuietHours, nextUnanswered }
  };
}
```

Note: `_internals` is a temporary bag so Tasks 6–7 can attach methods that reuse these without re-destructuring. Task 6 will refactor it into proper methods on the returned object — do NOT ship `_internals` long-term; Task 6 removes it.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: app-controller-batch tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/app-controller.js test/main/app-controller-batch.test.js
git commit -m "feat(app): controller ensureTodayBatch + getNext"
```

---

### Task 6: App controller — submitAnswer + getStatus (and finalize structure)

**Files:**
- Modify: `src/main/app-controller.js` (replace the whole file with the full version below — removes the `_internals` bag, adds `submitAnswer` + `getStatus`)
- Test: `test/main/app-controller-answer.test.js`

- [ ] **Step 1: Write the failing test** `test/main/app-controller-answer.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";
import { generateDailyBatch } from "../../src/core/engine.js";
import { gradeMc } from "../../src/core/grader.js";
import { recordCompletion } from "../../src/core/streak.js";
import { recordAnswer } from "../../src/core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../../src/core/scheduler.js";
import { createController } from "../../src/main/app-controller.js";

const fixedNow = () => new Date("2026-06-02T12:00:00");

function deps(statePath, extra = {}) {
  return {
    loadState, saveState, statePath, now: fixedNow,
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({
      async generateQuestions({ count }) {
        return JSON.stringify(Array.from({ length: count }, (_, i) => ({
          id: `q${i}`, deck: "d", topic: "T", source: "bank",
          type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 1, explanation: "because"
        })));
      },
      async gradeTyped() { return { correct: true, feedback: "good" }; },
      async hint() { return "think harder"; },
      ...extra.provider
    }),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  };
}

async function setup(questionsPerDay = 2) {
  const dir = await mkdtemp(join(tmpdir(), "papans-"));
  const path = join(dir, "state.json");
  const s = defaultState();
  s.settings.questionsPerDay = questionsPerDay;
  await saveState(path, s);
  return { dir, path };
}

test("submitAnswer grades MC, records score + topic stats", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  const r = await ctl.submitAnswer("q0", { selectedIndex: 1 });
  assert.equal(r.correct, true);
  assert.equal(r.explanation, "because");
  const state = await loadState(path);
  assert.equal(state.today.progress.q0.answered, true);
  assert.equal(state.dailyScores["2026-06-02"].correct, 1);
  assert.equal(state.dailyScores["2026-06-02"].total, 1);
  assert.equal(state.topicStats["d::T"].seen, 1);
  await rm(dir, { recursive: true, force: true });
});

test("finishing all questions bumps the streak", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  await ctl.submitAnswer("q0", { selectedIndex: 1 });
  await ctl.submitAnswer("q1", { selectedIndex: 0 }); // wrong, still completes the day
  const state = await loadState(path);
  assert.equal(state.streak.count, 1);
  assert.equal(state.streak.lastCompletedDate, "2026-06-02");
  await rm(dir, { recursive: true, force: true });
});

test("submitAnswer on a typed question uses provider.gradeTyped", async () => {
  const { dir, path } = await setup(1);
  const ctl = createController({
    ...deps(path),
    buildProvider: () => ({
      async generateQuestions({ count }) {
        return JSON.stringify(Array.from({ length: count }, (_, i) => ({
          id: `t${i}`, deck: "d", topic: "T", source: "bank",
          type: "typed", question: "q", answer: "42", explanation: "e"
        })));
      },
      async gradeTyped({ userAnswer }) { return { correct: userAnswer === "42", feedback: "f" }; },
      async hint() { return "h"; }
    })
  });
  await ctl.ensureTodayBatch();
  const r = await ctl.submitAnswer("t0", { typedAnswer: "42" });
  assert.equal(r.correct, true);
  await rm(dir, { recursive: true, force: true });
});

test("getStatus returns streak, today score, and a mood", async () => {
  const { dir, path } = await setup(2);
  const ctl = createController(deps(path));
  await ctl.ensureTodayBatch();
  await ctl.submitAnswer("q0", { selectedIndex: 1 });
  const st = await ctl.getStatus();
  assert.equal(st.streak, 0); // not all answered yet
  assert.equal(st.today.correct, 1);
  assert.ok(["happy","neutral","sad"].includes(st.mood));
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `submitAnswer`/`getStatus` not a function.

- [ ] **Step 3: Replace `src/main/app-controller.js` with the full version**

```js
import { moodFor } from "./personality.js";

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createController(deps) {
  const {
    loadState, saveState, statePath, now,
    loadActiveDecks, buildProvider, generateDailyBatch,
    gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  } = deps;

  async function ensureTodayBatch() {
    const state = await loadState(statePath);
    const today = isoDay(now());
    if (state.today.date === today && state.today.batch.length > 0) return state.today;
    const decks = await loadActiveDecks(state.settings.activeDecks);
    const provider = buildProvider(state.settings);
    const batch = await generateDailyBatch({
      decks, provider,
      count: state.settings.questionsPerDay,
      topicStats: state.topicStats,
      answerMode: state.settings.answerMode
    });
    state.today = { date: today, batch, progress: {} };
    await saveState(statePath, state);
    return state.today;
  }

  async function getNext() {
    const today = await ensureTodayBatch();
    return nextUnanswered(today.batch, today.progress);
  }

  async function submitAnswer(id, { selectedIndex, typedAnswer } = {}) {
    const state = await loadState(statePath);
    const q = state.today.batch.find(x => x.id === id);
    if (!q) throw new Error(`unknown question id: ${id}`);

    let result;
    if (q.type === "mc") {
      const g = gradeMc(q, selectedIndex);
      result = { correct: g.correct, explanation: g.explanation };
    } else {
      const provider = buildProvider(state.settings);
      const g = await provider.gradeTyped({ question: q, userAnswer: typedAnswer ?? "" });
      result = { correct: g.correct, explanation: q.explanation, feedback: g.feedback };
    }

    state.today.progress[id] = { answered: true, correct: result.correct };
    const day = state.today.date;
    const score = state.dailyScores[day] ?? { correct: 0, total: 0 };
    state.dailyScores[day] = { correct: score.correct + (result.correct ? 1 : 0), total: score.total + 1 };
    state.topicStats = recordAnswer(state.topicStats, q.deck, q.topic, result.correct);

    const allAnswered = state.today.batch.every(x => state.today.progress[x.id]?.answered);
    if (allAnswered) state.streak = recordCompletion(state.streak, day);

    await saveState(statePath, state);
    return { ...result, allAnswered };
  }

  async function getStatus() {
    const state = await loadState(statePath);
    const day = isoDay(now());
    const score = state.dailyScores[day] ?? { correct: 0, total: 0 };
    const streakAlive = state.streak.lastCompletedDate === day || state.streak.count > 0;
    const rate = score.total > 0 ? score.correct / score.total : 1;
    return { streak: state.streak.count, today: score, mood: moodFor({ streakAlive, recentScoreRate: rate }) };
  }

  async function getHint(id) {
    const state = await loadState(statePath);
    const q = state.today.batch.find(x => x.id === id);
    if (!q) throw new Error(`unknown question id: ${id}`);
    const provider = buildProvider(state.settings);
    return provider.hint({ question: q, sourceText: "" });
  }

  function hydrationDue() {
    return loadState(statePath).then(state => {
      if (!state.settings.hydration?.enabled) return false;
      const d = now();
      if (isQuietHours(d.getHours(), state.settings.quietStartHour, state.settings.quietEndHour)) return false;
      const intervalMs = state.settings.hydration.intervalMin * 60_000;
      return isHydrationDue(state.lastHydrationTs ?? null, d.getTime(), intervalMs);
    });
  }

  async function markHydrated() {
    const state = await loadState(statePath);
    state.lastHydrationTs = now().getTime();
    await saveState(statePath, state);
  }

  return { ensureTodayBatch, getNext, submitAnswer, getStatus, getHint, hydrationDue, markHydrated };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: app-controller-answer AND app-controller-batch tests PASS (the batch test still works against the finalized object).

- [ ] **Step 5: Commit**

```bash
git add src/main/app-controller.js test/main/app-controller-answer.test.js
git commit -m "feat(app): controller submitAnswer, getStatus, getHint, hydration"
```

---

### Task 7: App controller — hydration timing test

**Files:**
- Test: `test/main/app-controller-hydration.test.js`

- [ ] **Step 1: Write the test** (the implementation already exists from Task 6 — this locks its behavior):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";
import { generateDailyBatch } from "../../src/core/engine.js";
import { gradeMc } from "../../src/core/grader.js";
import { recordCompletion } from "../../src/core/streak.js";
import { recordAnswer } from "../../src/core/topics.js";
import { isHydrationDue, isQuietHours, nextUnanswered } from "../../src/core/scheduler.js";
import { createController } from "../../src/main/app-controller.js";

function ctlWith(statePath, nowDate) {
  return createController({
    loadState, saveState, statePath, now: () => nowDate,
    loadActiveDecks: async () => [{ deck: "d", mode: "bank", text: "" }],
    buildProvider: () => ({ async generateQuestions() { return "[]"; }, async gradeTyped() { return {correct:false,feedback:""}; }, async hint() { return ""; } }),
    generateDailyBatch, gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  });
}

async function stateFile(mut) {
  const dir = await mkdtemp(join(tmpdir(), "paphyd-"));
  const path = join(dir, "state.json");
  const s = defaultState(); mut?.(s);
  await saveState(path, s);
  return { dir, path };
}

test("hydrationDue true when enabled, daytime, never reminded", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  assert.equal(await ctl.hydrationDue(), true);
  await rm(dir, { recursive: true, force: true });
});

test("hydrationDue false during quiet hours", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T23:30:00")); // quiet 22-7
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});

test("hydrationDue false when disabled", async () => {
  const { dir, path } = await stateFile(s => { s.settings.hydration.enabled = false; });
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});

test("markHydrated then hydrationDue is false until interval passes", async () => {
  const { dir, path } = await stateFile();
  const ctl = ctlWith(path, new Date("2026-06-02T12:00:00"));
  await ctl.markHydrated();
  assert.equal(await ctl.hydrationDue(), false);
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify pass**

Run: `npm test`
Expected: all 4 hydration tests PASS (implementation from Task 6 already supports them).

- [ ] **Step 3: Commit**

```bash
git add test/main/app-controller-hydration.test.js
git commit -m "test(app): lock controller hydration timing"
```

---

### Task 8: Real main process — paths, pdf, IPC, preload, windows wiring

**Files:**
- Create: `src/main/paths.js`
- Create: `src/main/pdf.js`
- Create: `src/main/preload.js`
- Create: `src/main/ipc.js`
- Create: `src/main/windows.js`
- Replace: `src/main/main.js` (full version)

(Manual verification — no unit tests; this is Electron glue.)

- [ ] **Step 1: `src/main/paths.js`**

```js
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
```

- [ ] **Step 2: `src/main/pdf.js`** (real pdf-parse wrapper; pdf-parse is CommonJS, load via createRequire)

```js
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function parsePdf(buffer) {
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return { text: data.text ?? "" };
}
```

- [ ] **Step 3: `src/main/preload.js`** (exposes a typed surface to the renderer)

```js
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
  openPopup: () => ipcRenderer.invoke("papple:openPopup")
});
```
Note: preload runs in a CommonJS context — use `require`, not `import`. Set the BrowserWindow `webPreferences.preload` to this file and `sandbox: false` so `require` works.

- [ ] **Step 4: `src/main/ipc.js`** (registers handlers; takes the controller + helpers)

```js
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
```

- [ ] **Step 5: `src/main/windows.js`** (window factories)

```js
import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { rendererDir } from "./paths.js";

const preload = join(rendererDir, "..", "main", "preload.js");

export function createBuddyWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const w = 220, h = 240;
  const win = new BrowserWindow({
    width: w, height: h,
    x: workArea.x + workArea.width - w - 20,
    y: workArea.y + workArea.height - h - 20,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload, sandbox: false }
  });
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
```

- [ ] **Step 6: Replace `src/main/main.js`** (full wiring)

```js
import { app, Tray, Menu } from "electron";
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

function openPopup() {
  if (popupWin && !popupWin.isDestroyed()) { popupWin.focus(); return; }
  popupWin = createPopupWindow();
  popupWin.on("closed", () => { popupWin = null; });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = createSettingsWindow();
  settingsWin.on("closed", () => { settingsWin = null; });
}

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

  // hydration tick every 5 min
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
```
Note: provide a 16×16 or 32×32 `src/renderer/tray.png` (any simple pineapple icon). If you don't have one yet, create a 1×1 transparent PNG placeholder so `Tray` doesn't throw; Plan 3 replaces it with the real icon.

- [ ] **Step 7: Add a placeholder tray icon**

Create `src/renderer/tray.png` — any small PNG. Quick placeholder via Node:
Run:
```
node -e "import('node:fs').then(fs=>fs.writeFileSync('src/renderer/tray.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')))"
```
Expected: a 1×1 transparent `tray.png` exists.

- [ ] **Step 8: Verify the app boots with real wiring**

First make sure tests still pass: `npm test` → all green.
Then `npm start`. Expected: the buddy window appears in the bottom-right corner (it'll be empty/transparent until Task 9's renderer). A tray icon appears. No console errors about missing modules/preload. Close via tray → Quit.

- [ ] **Step 9: Commit**

```bash
git add src/main/ src/renderer/tray.png
git commit -m "feat(app): real main process — windows, tray, IPC, controller wiring"
```

---

### Task 9: Buddy renderer (corner buddy, clickable)

**Files:**
- Replace: `src/renderer/buddy.html`
- Create: `src/renderer/buddy.js`
- Create: `src/renderer/buddy.css`

(Manual verification. Minimal styling — Plan 3 adds the pixel sprite + animation.)

- [ ] **Step 1: `src/renderer/buddy.css`**

```css
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden;
  font-family: system-ui, sans-serif; -webkit-user-select: none; user-select: none; }
#buddy { position: absolute; bottom: 10px; right: 10px; text-align: center; cursor: pointer; }
#face { font-size: 96px; line-height: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,.3)); }
#bubble { max-width: 180px; margin: 0 auto 6px; background: #fff; color: #222;
  border-radius: 12px; padding: 8px 10px; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.25);
  display: none; }
#bubble.show { display: block; }
#badge { font-size: 12px; color: #444; background: #fff8; border-radius: 8px; padding: 2px 6px; display: inline-block; margin-top: 4px; }
.app-region { -webkit-app-region: drag; }
```

- [ ] **Step 2: `src/renderer/buddy.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="buddy.css"></head>
<body>
  <div id="buddy">
    <div id="bubble"></div>
    <div id="face">🍍</div>
    <div id="badge">🔥 0 · 0/0</div>
  </div>
  <script src="buddy.js"></script>
</body></html>
```

- [ ] **Step 3: `src/renderer/buddy.js`**

```js
const bubble = document.getElementById("bubble");
const badge = document.getElementById("badge");
const buddy = document.getElementById("buddy");

function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(say._t);
  say._t = setTimeout(() => bubble.classList.remove("show"), ms);
}

async function refreshBadge() {
  const st = await window.papple.getStatus();
  badge.textContent = `🔥 ${st.streak} · ${st.today.correct}/${st.today.total}`;
}

buddy.addEventListener("click", () => window.papple.openPopup());

// hydration nudge from main
const { ipcRenderer } = require("electron");
ipcRenderer.on("papple:hydrate", () => say("sip some water 🥤"));

refreshBadge();
setInterval(refreshBadge, 30_000);
say("click me to start your 10! 🍍");
```
Note: `require("electron")` works in the renderer only because `sandbox:false` and no `contextIsolation` override for `ipcRenderer.on`. If `require` is undefined in the renderer, instead expose an `onHydrate` callback through the preload `contextBridge` and use that; but with `sandbox:false` and default `nodeIntegration:false`, prefer adding `onHydrate: (cb)=>ipcRenderer.on("papple:hydrate",cb)` to `preload.js` and calling `window.papple.onHydrate(...)` here. Use the preload approach if `require` is unavailable.

- [ ] **Step 4: Verify**

Run: `npm start`. Expected: bottom-right shows the 🍍 with a "click me to start your 10!" bubble and a `🔥 0 · 0/0` badge. Clicking it opens the (empty until Task 10) popup window.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/buddy.html src/renderer/buddy.js src/renderer/buddy.css
git commit -m "feat(app): buddy corner window (functional, unstyled)"
```

---

### Task 10: Popup renderer (the question loop)

**Files:**
- Create: `src/renderer/popup.html`
- Create: `src/renderer/popup.js`
- Create: `src/renderer/popup.css`

(Manual verification.)

- [ ] **Step 1: `src/renderer/popup.css`**

```css
html, body { margin: 0; height: 100%; background: transparent; font-family: system-ui, sans-serif; }
#card { position: absolute; inset: 8px; background: #fffef8; border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,.3); padding: 16px; display: flex; flex-direction: column; }
#q { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.opt { display: block; width: 100%; text-align: left; margin: 6px 0; padding: 10px;
  border: 2px solid #e5e0cf; border-radius: 10px; background: #fff; cursor: pointer; font-size: 14px; }
.opt:hover { border-color: #f1c40f; }
.opt.correct { border-color: #2ecc71; background: #eafaf0; }
.opt.wrong { border-color: #e74c3c; background: #fdeaea; }
#typed { width: 100%; padding: 10px; border: 2px solid #e5e0cf; border-radius: 10px; font-size: 14px; }
#feedback { margin-top: 12px; font-size: 14px; }
.row { margin-top: auto; display: flex; gap: 8px; }
button.action { padding: 10px 14px; border: none; border-radius: 10px; background: #f1c40f; cursor: pointer; font-weight: 600; }
button.ghost { background: #eee; }
</style>
```
(Remove the stray `</style>` if your engine flags it — it belongs only inside HTML; the file is pure CSS so delete that last line.)

- [ ] **Step 2: `src/renderer/popup.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="popup.css"></head>
<body>
  <div id="card">
    <div id="q">Loading…</div>
    <div id="answers"></div>
    <div id="feedback"></div>
    <div class="row">
      <button id="hint" class="action ghost">Hint</button>
      <button id="next" class="action" style="display:none">Next →</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body></html>
```

- [ ] **Step 3: `src/renderer/popup.js`**

```js
const qEl = document.getElementById("q");
const ansEl = document.getElementById("answers");
const fbEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const hintBtn = document.getElementById("hint");
let current = null;

async function load() {
  fbEl.textContent = ""; ansEl.innerHTML = ""; nextBtn.style.display = "none"; hintBtn.style.display = "";
  current = await window.papple.getNext();
  if (!current) { qEl.textContent = "That's all 10 — nice work today! 🍍"; hintBtn.style.display = "none"; return; }
  qEl.textContent = current.question;
  if (current.type === "mc") {
    current.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = opt;
      b.onclick = () => answerMc(b, i);
      ansEl.appendChild(b);
    });
  } else {
    const input = document.createElement("input");
    input.id = "typed"; input.placeholder = "type your answer…";
    const submit = document.createElement("button");
    submit.className = "opt"; submit.textContent = "Submit";
    submit.onclick = () => answerTyped(input.value);
    ansEl.appendChild(input); ansEl.appendChild(submit);
  }
}

async function answerMc(btn, idx) {
  [...ansEl.children].forEach(c => c.onclick = null);
  const r = await window.papple.submitAnswer(current.id, { selectedIndex: idx });
  btn.classList.add(r.correct ? "correct" : "wrong");
  if (!r.correct) ansEl.children[current.answerIndex].classList.add("correct");
  showFeedback(r);
}

async function answerTyped(value) {
  const r = await window.papple.submitAnswer(current.id, { typedAnswer: value });
  showFeedback(r);
}

function showFeedback(r) {
  fbEl.textContent = (r.correct ? "✅ " : "❌ ") + (r.feedback || r.explanation || "");
  hintBtn.style.display = "none";
  nextBtn.style.display = "";
}

hintBtn.onclick = async () => { hintBtn.disabled = true; fbEl.textContent = "💡 " + await window.papple.getHint(current.id); hintBtn.disabled = false; };
nextBtn.onclick = load;
load();
```

- [ ] **Step 4: Verify the full loop**

Run: `npm start`. **Set your Claude key first** (Task 11 builds Settings; for now you can pre-seed it: open the state file at the path printed by adding a temporary `console.log(statePath(app))` in main, or just run Task 11 first). With a key + at least one active deck, click Papple → a question appears → answering shows ✅/❌ + explanation → Next advances → after the last one, "that's all 10". Streak badge on the buddy updates.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/popup.html src/renderer/popup.js src/renderer/popup.css
git commit -m "feat(app): quiz popup (mc + typed + hint + feedback)"
```

---

### Task 11: Settings renderer

**Files:**
- Create: `src/renderer/settings.html`
- Create: `src/renderer/settings.js`
- Create: `src/renderer/settings.css`

(Manual verification.)

- [ ] **Step 1: `src/renderer/settings.css`**

```css
body { font-family: system-ui, sans-serif; padding: 16px; color: #222; }
label { display: block; margin: 10px 0 4px; font-weight: 600; font-size: 13px; }
input, select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
.deck { font-weight: 400; display: flex; align-items: center; gap: 8px; margin: 2px 0; }
.deck input { width: auto; }
#save { margin-top: 16px; padding: 10px 16px; border: none; border-radius: 8px; background: #f1c40f; font-weight: 700; cursor: pointer; }
#status { margin-left: 10px; color: #2ecc71; }
.row2 { display: flex; gap: 12px; }
.row2 > div { flex: 1; }
```

- [ ] **Step 2: `src/renderer/settings.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="settings.css"><title>Papple Settings</title></head>
<body>
  <h2>🍍 Papple Settings</h2>
  <label>AI mode</label>
  <select id="aiMode"><option value="claude">Claude (API key)</option><option value="ollama">Local (Ollama)</option></select>
  <label>Claude API key</label>
  <input id="apiKey" type="password" placeholder="sk-ant-…">
  <div class="row2">
    <div><label>Questions/day</label><input id="questionsPerDay" type="number" min="1" max="50"></div>
    <div><label>Answer mode</label>
      <select id="answerMode"><option value="both">Both</option><option value="mc">Multiple choice</option><option value="typed">Typed</option></select>
    </div>
  </div>
  <div class="row2">
    <div><label>Pace</label><select id="pace"><option value="nudge">Nudge</option><option value="session">Session</option></select></div>
    <div><label>Nudge interval (min)</label><input id="nudgeIntervalMin" type="number" min="5"></div>
  </div>
  <div class="row2">
    <div><label>Quiet start (hr)</label><input id="quietStartHour" type="number" min="0" max="23"></div>
    <div><label>Quiet end (hr)</label><input id="quietEndHour" type="number" min="0" max="23"></div>
  </div>
  <label><input id="hydrationEnabled" type="checkbox"> Hydration reminders</label>
  <label>Hydration interval (min)</label><input id="hydrationIntervalMin" type="number" min="10">
  <label>Active decks</label>
  <div id="decks"></div>
  <button id="save">Save</button><span id="status"></span>
  <script src="settings.js"></script>
</body></html>
```

- [ ] **Step 3: `src/renderer/settings.js`**

```js
const $ = id => document.getElementById(id);

async function init() {
  const s = await window.papple.getSettings();
  $("aiMode").value = s.aiMode;
  $("apiKey").value = s.apiKey || "";
  $("questionsPerDay").value = s.questionsPerDay;
  $("answerMode").value = s.answerMode;
  $("pace").value = s.pace;
  $("nudgeIntervalMin").value = s.nudgeIntervalMin;
  $("quietStartHour").value = s.quietStartHour;
  $("quietEndHour").value = s.quietEndHour;
  $("hydrationEnabled").checked = s.hydration.enabled;
  $("hydrationIntervalMin").value = s.hydration.intervalMin;

  const decks = await window.papple.listDecks();
  const active = s.activeDecks.length ? s.activeDecks : decks; // empty = all on
  const box = $("decks");
  box.innerHTML = "";
  decks.forEach(d => {
    const label = document.createElement("label");
    label.className = "deck";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = d; cb.checked = active.includes(d);
    label.appendChild(cb); label.append(" " + d);
    box.appendChild(label);
  });
}

$("save").onclick = async () => {
  const decks = [...document.querySelectorAll("#decks input:checked")].map(c => c.value);
  await window.papple.saveSettings({
    aiMode: $("aiMode").value,
    apiKey: $("apiKey").value,
    questionsPerDay: Number($("questionsPerDay").value),
    answerMode: $("answerMode").value,
    pace: $("pace").value,
    nudgeIntervalMin: Number($("nudgeIntervalMin").value),
    quietStartHour: Number($("quietStartHour").value),
    quietEndHour: Number($("quietEndHour").value),
    hydration: { enabled: $("hydrationEnabled").checked, intervalMin: Number($("hydrationIntervalMin").value) },
    activeDecks: decks
  });
  $("status").textContent = "saved ✓";
  setTimeout(() => $("status").textContent = "", 1500);
};

init();
```

- [ ] **Step 4: Verify**

Run: `npm start` → open Settings from the tray. Form loads current values + lists your deck folders as checkboxes. Paste your Claude key, pick active decks, Save → "saved ✓". Reopen to confirm persistence. Then the popup loop (Task 10) should generate real questions.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/settings.html src/renderer/settings.js src/renderer/settings.css
git commit -m "feat(app): settings window"
```

---

### Task 12: End-to-end smoke + push

- [ ] **Step 1: Full test suite green**

Run: `npm test`
Expected: all Plan 1 + Plan 2 tests pass (60 + the new main-process tests).

- [ ] **Step 2: Manual end-to-end**

Run: `npm start`. With Claude key set and ≥1 deck active:
- Buddy sits bottom-right, badge shows streak/score.
- Click → popup → answer 10 questions (mix of mc/typed) → ✅/❌ + explanations → "that's all 10".
- Streak badge increments after finishing.
- Settings persists across restarts.
- Tray menu: Quiz me now / Settings / Quit all work.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Definition of Done (Plan 2)

- `npm test` green (Plan 1 core + Plan 2 testable units: provider-factory, personality, decks-loader, app-controller batch/answer/hydration).
- `npm start` launches a corner buddy; clicking it runs the real daily-question loop end-to-end (generation → grading → streak/score/topic tracking → persistence) using the chosen AI provider.
- Settings window edits all knobs and persists; decks list reflects `papple-sources/` folders.
- Hydration nudge fires on its timer outside quiet hours.
- App is functional but minimally styled — **Plan 3** adds the pixel-art Papple sprite, animations, the full personality bubble/face system, and the extras (drag/wobble, sleep, idle chatter, polished hint), designed in the visual companion.

## Self-Review (completed by author)

- **Spec coverage:** provider selection (factory) ✓; daily batch generation + caching (controller.ensureTodayBatch) ✓; MC + typed answering + grading (submitAnswer) ✓; streak/score/weak-topic tracking ✓; hint ✓; settings UI incl. decks/hydration/quiet hours/answer mode/pace ✓; deck files-vs-bank (decks-loader) ✓; hydration timing ✓; corner buddy + popup + tray ✓. Pixel sprite, mood animation, drag/sleep/idle-chatter, personality bubble polish → explicitly deferred to Plan 3. Packaging → Plan 4.
- **Type/interface consistency:** controller built once with the deps contract; `window.papple.*` preload surface matches `ipc.js` channel names exactly (`getNext`, `submitAnswer`, `getStatus`, `getHint`, `getSettings`, `saveSettings`, `listDecks`, `openSettings`, `openPopup`); `submitAnswer(id,{selectedIndex|typedAnswer})` consistent between popup.js, preload, ipc, controller; provider method names (`generateQuestions`/`gradeTyped`/`hint`) match Plan 1 providers.
- **Placeholders:** none — complete code in every step. Two inline notes call out Electron-specific fallbacks (renderer `require` vs preload-exposed `onHydrate`; the stray `</style>` to delete) so the implementer isn't guessing.
- **Known follow-ups for Plan 3:** wire `personality.pappleLine` into the bubble for every state/reaction (currently buddy uses a couple of hardcoded strings); replace 🍍 emoji + tray.png with real pixel art; add drag/sleep/idle-chatter; nudge-mode auto-popup (Plan 2 ships click-to-quiz + hydration tick; scheduled nudge popups can layer on in Plan 3).
