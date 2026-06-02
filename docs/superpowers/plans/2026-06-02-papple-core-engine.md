# Papple Core Engine — Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-Node, fully-tested core logic library that powers Papple — sources/decks loading, question schema, AI providers (Claude + Ollama), the generation engine, grading, streak/topic tracking, storage, and scheduler — with zero Electron dependency.

**Architecture:** Plain ESM JavaScript modules under `src/core/`, each with one responsibility and a small interface. No Electron, no DOM. All side-effecty boundaries (network, PDF parsing) are dependency-injected so everything is unit-testable. The Electron layer (Plan 2) imports these modules and wires real `fetch`/`pdf-parse`/file paths.

**Tech Stack:** Node 18+ (built-in `fetch`), ESM (`"type": "module"`), built-in test runner (`node --test`) + `node:assert/strict`. Runtime dep: `pdf-parse` (injected, used by Electron layer). No test framework deps.

**Scope:** This is Plan 1 of 4. It produces a tested core library, not a running app. Plans 2 (Electron UI), 3 (content banks), 4 (packaging/showcase) follow.

---

## File Structure

```
papple/
├─ package.json                 # type:module, test script, pdf-parse dep
├─ src/core/
│  ├─ schema.js                 # question validation
│  ├─ storage.js                # state load/save + defaults
│  ├─ streak.js                 # streak math
│  ├─ topics.js                 # per-topic stats + weak-topic selection
│  ├─ sources.js                # file parsing + chunking (pdf injected)
│  ├─ decks.js                  # deck discovery + text resolution
│  ├─ grader.js                 # MC grading
│  ├─ engine.js                 # prompt building + JSON parse + daily batch
│  ├─ scheduler.js              # quiet hours, next question, hydration timing
│  └─ providers/
│     ├─ claude.js              # Anthropic provider (fetch injected)
│     └─ ollama.js              # local Ollama provider (fetch injected)
└─ test/core/                   # one test file per module
```

**Question object shape (the contract every module shares):**
```js
{
  id: "string",            // unique
  deck: "string",          // e.g. "ap-chem"
  topic: "string",         // e.g. "Stoichiometry"
  source: "string",        // filename or "bank"
  type: "mc" | "typed",
  question: "string",
  options: ["a","b","c","d"], // mc only
  answerIndex: 0,             // mc only, index into options
  answer: "string",           // typed only, expected answer
  explanation: "string"
}
```

**State object shape (storage):**
```js
{
  settings: { activeDecks: [], answerMode: "both", pace: "nudge",
              nudgeIntervalMin: 90, questionsPerDay: 10,
              quietStartHour: 22, quietEndHour: 7,
              hydration: { enabled: true, intervalMin: 60 },
              aiMode: "claude", apiKey: "", ollamaModel: "llama3.2",
              sourcesDir: "" },
  streak: { count: 0, lastCompletedDate: null },   // date = "YYYY-MM-DD"
  dailyScores: {},                                  // "YYYY-MM-DD": {correct,total}
  topicStats: {},                                   // "deck::topic": {seen,missed}
  today: { date: null, batch: [], progress: {} },   // progress: id -> {answered,correct}
  buddyPosition: { x: null, y: null }
}
```

---

### Task 1: Project init + test harness

**Files:**
- Create: `package.json`
- Create: `test/core/smoke.test.js`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "papple",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  },
  "dependencies": {
    "pdf-parse": "^1.1.1"
  }
}
```

- [ ] **Step 2: Write a smoke test to prove the harness runs**

`test/core/smoke.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("test harness runs", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Run it**

Run: `npm test`
Expected: 1 test passing. (Run `npm install` first if `pdf-parse` isn't installed; the smoke test itself needs no deps.)

- [ ] **Step 4: Commit**

```bash
git add package.json test/core/smoke.test.js
git commit -m "chore: init core project + test harness"
```

---

### Task 2: Question schema validation

**Files:**
- Create: `src/core/schema.js`
- Test: `test/core/schema.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/schema.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateQuestion, assertValidQuestion } from "../../src/core/schema.js";

const baseMc = {
  id: "q1", deck: "ap-chem", topic: "Stoichiometry", source: "bank",
  type: "mc", question: "2+2?", options: ["3","4","5","6"],
  answerIndex: 1, explanation: "It's 4."
};
const baseTyped = {
  id: "q2", deck: "ap-chem", topic: "Moles", source: "bank",
  type: "typed", question: "Avogadro's number?", answer: "6.022e23",
  explanation: "Definition."
};

test("valid mc question passes", () => {
  assert.equal(validateQuestion(baseMc).valid, true);
});

test("valid typed question passes", () => {
  assert.equal(validateQuestion(baseTyped).valid, true);
});

test("mc with bad answerIndex fails", () => {
  const r = validateQuestion({ ...baseMc, answerIndex: 9 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.includes("answerIndex")));
});

test("mc needing 4 options fails with 2", () => {
  const r = validateQuestion({ ...baseMc, options: ["a","b"] });
  assert.equal(r.valid, false);
});

test("unknown type fails", () => {
  const r = validateQuestion({ ...baseMc, type: "essay" });
  assert.equal(r.valid, false);
});

test("missing required field fails", () => {
  const { question, ...noQ } = baseMc;
  assert.equal(validateQuestion(noQ).valid, false);
});

test("assertValidQuestion throws on invalid", () => {
  assert.throws(() => assertValidQuestion({ ...baseMc, type: "x" }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module .../schema.js`.

- [ ] **Step 3: Implement `src/core/schema.js`**

```js
export const QUESTION_TYPES = ["mc", "typed"];

const COMMON_FIELDS = ["id", "deck", "topic", "source", "type", "question", "explanation"];

export function validateQuestion(q) {
  const errors = [];
  if (q == null || typeof q !== "object") {
    return { valid: false, errors: ["question is not an object"] };
  }
  for (const f of COMMON_FIELDS) {
    if (typeof q[f] !== "string" || q[f].length === 0) {
      errors.push(`missing/empty field: ${f}`);
    }
  }
  if (!QUESTION_TYPES.includes(q.type)) {
    errors.push(`invalid type: ${q.type}`);
  }
  if (q.type === "mc") {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push("mc requires exactly 4 options");
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 ||
        (Array.isArray(q.options) && q.answerIndex >= q.options.length)) {
      errors.push("mc answerIndex out of range");
    }
  }
  if (q.type === "typed") {
    if (typeof q.answer !== "string" || q.answer.length === 0) {
      errors.push("typed requires non-empty answer");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidQuestion(q) {
  const { valid, errors } = validateQuestion(q);
  if (!valid) throw new Error(`Invalid question: ${errors.join("; ")}`);
  return q;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: schema tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/schema.js test/core/schema.test.js
git commit -m "feat(core): question schema validation"
```

---

### Task 3: Storage (state load/save + defaults)

**Files:**
- Create: `src/core/storage.js`
- Test: `test/core/storage.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/storage.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultState, loadState, saveState } from "../../src/core/storage.js";

test("defaultState has expected keys", () => {
  const s = defaultState();
  assert.equal(s.streak.count, 0);
  assert.equal(s.streak.lastCompletedDate, null);
  assert.deepEqual(s.topicStats, {});
  assert.equal(s.settings.questionsPerDay, 10);
  assert.equal(s.settings.hydration.enabled, true);
});

test("loadState returns defaults when file missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const s = await loadState(join(dir, "nope.json"));
  assert.equal(s.streak.count, 0);
  await rm(dir, { recursive: true, force: true });
});

test("saveState then loadState round-trips", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const file = join(dir, "state.json");
  const s = defaultState();
  s.streak.count = 5;
  await saveState(file, s);
  const loaded = await loadState(file);
  assert.equal(loaded.streak.count, 5);
  await rm(dir, { recursive: true, force: true });
});

test("loadState merges missing keys onto defaults", async () => {
  const dir = await mkdtemp(join(tmpdir(), "papple-"));
  const file = join(dir, "state.json");
  await saveState(file, { streak: { count: 3, lastCompletedDate: "2026-06-01" } });
  const loaded = await loadState(file);
  assert.equal(loaded.streak.count, 3);
  assert.equal(loaded.settings.questionsPerDay, 10); // default filled in
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `storage.js`.

- [ ] **Step 3: Implement `src/core/storage.js`**

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function defaultState() {
  return {
    settings: {
      activeDecks: [],
      answerMode: "both",
      pace: "nudge",
      nudgeIntervalMin: 90,
      questionsPerDay: 10,
      quietStartHour: 22,
      quietEndHour: 7,
      hydration: { enabled: true, intervalMin: 60 },
      aiMode: "claude",
      apiKey: "",
      ollamaModel: "llama3.2",
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: storage tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.js test/core/storage.test.js
git commit -m "feat(core): state storage with default merge"
```

---

### Task 4: Streak math

**Files:**
- Create: `src/core/streak.js`
- Test: `test/core/streak.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/streak.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayDiff, recordCompletion } from "../../src/core/streak.js";

test("dayDiff counts whole days", () => {
  assert.equal(dayDiff("2026-06-01", "2026-06-02"), 1);
  assert.equal(dayDiff("2026-06-01", "2026-06-01"), 0);
  assert.equal(dayDiff("2026-06-01", "2026-06-05"), 4);
});

test("first completion sets streak to 1", () => {
  const s = recordCompletion({ count: 0, lastCompletedDate: null }, "2026-06-02");
  assert.deepEqual(s, { count: 1, lastCompletedDate: "2026-06-02" });
});

test("consecutive day increments", () => {
  const s = recordCompletion({ count: 3, lastCompletedDate: "2026-06-01" }, "2026-06-02");
  assert.equal(s.count, 4);
});

test("same day is a no-op on count", () => {
  const s = recordCompletion({ count: 3, lastCompletedDate: "2026-06-02" }, "2026-06-02");
  assert.equal(s.count, 3);
});

test("gap resets to 1", () => {
  const s = recordCompletion({ count: 9, lastCompletedDate: "2026-06-01" }, "2026-06-05");
  assert.equal(s.count, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `streak.js`.

- [ ] **Step 3: Implement `src/core/streak.js`**

```js
// dates are "YYYY-MM-DD" strings (local calendar days)
export function dayDiff(aIso, bIso) {
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export function recordCompletion(streak, todayIso) {
  if (!streak.lastCompletedDate) {
    return { count: 1, lastCompletedDate: todayIso };
  }
  const diff = dayDiff(streak.lastCompletedDate, todayIso);
  if (diff === 0) return { ...streak };                       // already counted today
  if (diff === 1) return { count: streak.count + 1, lastCompletedDate: todayIso };
  return { count: 1, lastCompletedDate: todayIso };           // missed day(s) -> reset
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: streak tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/streak.js test/core/streak.test.js
git commit -m "feat(core): streak math"
```

---

### Task 5: Topic stats + weak-topic selection

**Files:**
- Create: `src/core/topics.js`
- Test: `test/core/topics.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/topics.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { topicKey, recordAnswer, weakTopics } from "../../src/core/topics.js";

test("topicKey joins deck and topic", () => {
  assert.equal(topicKey("ap-chem", "Moles"), "ap-chem::Moles");
});

test("recordAnswer increments seen, and missed when wrong", () => {
  let stats = {};
  stats = recordAnswer(stats, "ap-chem", "Moles", true);
  stats = recordAnswer(stats, "ap-chem", "Moles", false);
  assert.deepEqual(stats["ap-chem::Moles"], { seen: 2, missed: 1 });
});

test("weakTopics ranks by miss rate descending", () => {
  const stats = {
    "d::A": { seen: 10, missed: 1 },   // 0.1
    "d::B": { seen: 4, missed: 3 },    // 0.75
    "d::C": { seen: 5, missed: 2 }     // 0.4
  };
  const weak = weakTopics(stats, 2);
  assert.deepEqual(weak, [
    { key: "d::B", deck: "d", topic: "B", rate: 0.75 },
    { key: "d::C", deck: "d", topic: "C", rate: 0.4 }
  ]);
});

test("weakTopics ignores topics never seen", () => {
  const weak = weakTopics({ "d::A": { seen: 0, missed: 0 } }, 5);
  assert.equal(weak.length, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `topics.js`.

- [ ] **Step 3: Implement `src/core/topics.js`**

```js
export function topicKey(deck, topic) {
  return `${deck}::${topic}`;
}

export function recordAnswer(stats, deck, topic, correct) {
  const key = topicKey(deck, topic);
  const cur = stats[key] ?? { seen: 0, missed: 0 };
  const next = { seen: cur.seen + 1, missed: cur.missed + (correct ? 0 : 1) };
  return { ...stats, [key]: next };
}

export function weakTopics(stats, limit) {
  return Object.entries(stats)
    .filter(([, v]) => v.seen > 0)
    .map(([key, v]) => {
      const [deck, topic] = key.split("::");
      return { key, deck, topic, rate: v.missed / v.seen };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: topics tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/topics.js test/core/topics.test.js
git commit -m "feat(core): topic stats + weak-topic ranking"
```

---

### Task 6: Source parsing + chunking

**Files:**
- Create: `src/core/sources.js`
- Test: `test/core/sources.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/sources.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripFrontmatter, chunkText, loadDeckFiles } from "../../src/core/sources.js";

test("stripFrontmatter removes leading YAML block", () => {
  const md = "---\ntags: [a]\n---\n# Title\nbody";
  assert.equal(stripFrontmatter(md), "# Title\nbody");
});

test("stripFrontmatter leaves plain text untouched", () => {
  assert.equal(stripFrontmatter("no frontmatter"), "no frontmatter");
});

test("chunkText splits on size and never exceeds max", () => {
  const text = "abcdefghij".repeat(50); // 500 chars
  const chunks = chunkText(text, 120);
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every(c => c.length <= 120));
});

test("loadDeckFiles reads md and parses pdf via injected parser", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-"));
  await writeFile(join(dir, "notes.md"), "---\nx: 1\n---\nMarkdown body");
  await writeFile(join(dir, "review.pdf"), "binary-ish");
  const fakeParser = async (buf) => ({ text: "PDF text from " + buf.length + " bytes" });
  const files = await loadDeckFiles(dir, { pdfParser: fakeParser });
  const names = files.map(f => f.source).sort();
  assert.deepEqual(names, ["notes.md", "review.pdf"]);
  assert.ok(files.find(f => f.source === "notes.md").text.includes("Markdown body"));
  assert.ok(files.find(f => f.source === "review.pdf").text.includes("PDF text"));
  await rm(dir, { recursive: true, force: true });
});

test("loadDeckFiles skips files that fail to parse", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-"));
  await writeFile(join(dir, "ok.md"), "fine");
  await writeFile(join(dir, "bad.pdf"), "x");
  const throwingParser = async () => { throw new Error("scanned image"); };
  const skipped = [];
  const files = await loadDeckFiles(dir, {
    pdfParser: throwingParser,
    onSkip: (name, err) => skipped.push([name, err.message])
  });
  assert.deepEqual(files.map(f => f.source), ["ok.md"]);
  assert.deepEqual(skipped, [["bad.pdf", "scanned image"]]);
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `sources.js`.

- [ ] **Step 3: Implement `src/core/sources.js`**

```js
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

export function stripFrontmatter(text) {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const after = text.indexOf("\n", end + 1);
      return text.slice(after + 1);
    }
  }
  return text;
}

// split into <=maxChars chunks, preferring paragraph boundaries
export function chunkText(text, maxChars = 2000) {
  const chunks = [];
  let buf = "";
  for (const para of text.split(/\n\s*\n/)) {
    if ((buf + "\n\n" + para).length > maxChars && buf) {
      chunks.push(buf);
      buf = "";
    }
    if (para.length > maxChars) {
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
    } else {
      buf = buf ? buf + "\n\n" + para : para;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export async function loadDeckFiles(deckDir, { pdfParser, onSkip = () => {} } = {}) {
  let entries;
  try {
    entries = await readdir(deckDir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    if (ext !== ".md" && ext !== ".pdf") continue;
    const full = join(deckDir, name);
    try {
      if (ext === ".md") {
        const raw = await readFile(full, "utf8");
        out.push({ source: name, text: stripFrontmatter(raw) });
      } else {
        if (!pdfParser) throw new Error("no pdf parser provided");
        const buf = await readFile(full);
        const { text } = await pdfParser(buf);
        out.push({ source: name, text });
      }
    } catch (err) {
      onSkip(name, err);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: sources tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources.js test/core/sources.test.js
git commit -m "feat(core): source parsing + chunking"
```

---

### Task 7: Deck discovery + text resolution

**Files:**
- Create: `src/core/decks.js`
- Test: `test/core/decks.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/decks.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDeckDirs, activeDeckDirs, resolveDeckText } from "../../src/core/decks.js";

test("listDeckDirs returns only subdirectories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "src-"));
  await mkdir(join(dir, "ap-chem"));
  await mkdir(join(dir, "apush"));
  await writeFile(join(dir, "README.md"), "x");
  const decks = await listDeckDirs(dir);
  assert.deepEqual(decks.sort(), ["ap-chem", "apush"]);
  await rm(dir, { recursive: true, force: true });
});

test("activeDeckDirs filters by settings, empty = all", () => {
  const all = ["ap-chem", "apush", "hc-chem-sem1"];
  assert.deepEqual(activeDeckDirs(all, ["apush"]), ["apush"]);
  assert.deepEqual(activeDeckDirs(all, []), all);
});

test("resolveDeckText: files present -> mode files with joined text", () => {
  const files = [{ source: "a.md", text: "alpha" }, { source: "b.md", text: "beta" }];
  const r = resolveDeckText("ap-chem", files);
  assert.equal(r.mode, "files");
  assert.ok(r.text.includes("alpha") && r.text.includes("beta"));
});

test("resolveDeckText: no usable files -> mode bank", () => {
  const r = resolveDeckText("ap-chem", []);
  assert.equal(r.mode, "bank");
  assert.equal(r.text, "");
});

test("resolveDeckText: whitespace-only files -> mode bank", () => {
  const r = resolveDeckText("ap-chem", [{ source: "a.md", text: "   \n  " }]);
  assert.equal(r.mode, "bank");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `decks.js`.

- [ ] **Step 3: Implement `src/core/decks.js`**

```js
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function listDeckDirs(sourcesDir) {
  let entries;
  try {
    entries = await readdir(sourcesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

export function activeDeckDirs(allDecks, activeSetting) {
  if (!activeSetting || activeSetting.length === 0) return allDecks;
  return allDecks.filter(d => activeSetting.includes(d));
}

export function resolveDeckText(deckName, files) {
  const text = files.map(f => f.text).join("\n\n").trim();
  if (text.length === 0) return { deck: deckName, mode: "bank", text: "" };
  return { deck: deckName, mode: "files", text };
}
```

Note: `join` import retained for callers that build deck dir paths (Electron layer); harmless here.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: decks tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/decks.js test/core/decks.test.js
git commit -m "feat(core): deck discovery + text resolution"
```

---

### Task 8: MC grader

**Files:**
- Create: `src/core/grader.js`
- Test: `test/core/grader.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/grader.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeMc } from "../../src/core/grader.js";

const q = {
  id: "q1", type: "mc", question: "2+2?", options: ["3","4","5","6"],
  answerIndex: 1, explanation: "It's 4."
};

test("correct selection grades correct", () => {
  const r = gradeMc(q, 1);
  assert.equal(r.correct, true);
  assert.equal(r.correctIndex, 1);
  assert.equal(r.explanation, "It's 4.");
});

test("wrong selection grades incorrect", () => {
  const r = gradeMc(q, 0);
  assert.equal(r.correct, false);
  assert.equal(r.correctIndex, 1);
});

test("throws on non-mc question", () => {
  assert.throws(() => gradeMc({ ...q, type: "typed" }, 1));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `grader.js`.

- [ ] **Step 3: Implement `src/core/grader.js`**

```js
export function gradeMc(question, selectedIndex) {
  if (question.type !== "mc") {
    throw new Error("gradeMc called on non-mc question");
  }
  return {
    correct: selectedIndex === question.answerIndex,
    correctIndex: question.answerIndex,
    explanation: question.explanation
  };
}
```

(Typed grading is handled by the AI provider in Task 10/11, not here.)

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: grader tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/grader.js test/core/grader.test.js
git commit -m "feat(core): MC grader"
```

---

### Task 9: Engine — prompt building + JSON parsing

**Files:**
- Create: `src/core/engine.js`
- Test: `test/core/engine.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/engine.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationPrompt, parseQuestionsJson } from "../../src/core/engine.js";

test("prompt includes deck, count, answer mode, source text", () => {
  const p = buildGenerationPrompt({
    deckName: "ap-chem", sourceText: "MOLES AND STOICH",
    focusTopics: ["Stoichiometry"], count: 5, answerMode: "mc"
  });
  assert.ok(p.includes("ap-chem"));
  assert.ok(p.includes("5"));
  assert.ok(p.includes("MOLES AND STOICH"));
  assert.ok(p.includes("Stoichiometry"));
  assert.ok(/multiple choice|mc/i.test(p));
});

test("prompt for bank mode (no source) asks to use curriculum knowledge", () => {
  const p = buildGenerationPrompt({
    deckName: "apush", sourceText: "", focusTopics: [], count: 3, answerMode: "both"
  });
  assert.ok(/curriculum|standard|your knowledge/i.test(p));
});

test("parseQuestionsJson extracts a JSON array from fenced text", () => {
  const raw = 'Sure!\n```json\n[{"id":"x","deck":"ap-chem","topic":"T","source":"bank",' +
    '"type":"mc","question":"q","options":["a","b","c","d"],"answerIndex":0,' +
    '"explanation":"e"}]\n```\n';
  const qs = parseQuestionsJson(raw, "ap-chem");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].deck, "ap-chem");
});

test("parseQuestionsJson backfills deck when model omits it", () => {
  const raw = '[{"id":"x","topic":"T","source":"bank","type":"typed",' +
    '"question":"q","answer":"a","explanation":"e"}]';
  const qs = parseQuestionsJson(raw, "apush");
  assert.equal(qs[0].deck, "apush");
});

test("parseQuestionsJson throws when no valid questions", () => {
  assert.throws(() => parseQuestionsJson("no json here", "ap-chem"));
});

test("parseQuestionsJson drops invalid items but keeps valid ones", () => {
  const raw = '[{"bad":true},{"id":"y","deck":"d","topic":"T","source":"bank",' +
    '"type":"mc","question":"q","options":["a","b","c","d"],"answerIndex":2,' +
    '"explanation":"e"}]';
  const qs = parseQuestionsJson(raw, "d");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].id, "y");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `engine.js`.

- [ ] **Step 3: Implement `src/core/engine.js` (prompt + parse only for now)**

```js
import { validateQuestion } from "./schema.js";

export function buildGenerationPrompt({ deckName, sourceText, focusTopics = [], count, answerMode }) {
  const modeLine =
    answerMode === "mc" ? "All questions must be multiple choice (mc)." :
    answerMode === "typed" ? "All questions must be typed short-answer (typed)." :
    "Use a mix of multiple choice (mc) and typed short-answer (typed).";

  const sourceBlock = sourceText && sourceText.trim().length > 0
    ? `Base the questions ONLY on this source material:\n"""\n${sourceText}\n"""`
    : `There is no source file for this deck. Use your own knowledge of the standard ${deckName} curriculum to write exam-style questions.`;

  const focusLine = focusTopics.length
    ? `Emphasize these weak topics the student keeps missing: ${focusTopics.join(", ")}.`
    : "";

  return [
    `You are Papple, a study buddy. Generate exactly ${count} quiz questions for the deck "${deckName}".`,
    modeLine,
    focusLine,
    sourceBlock,
    `Return ONLY a JSON array. Each item must have these fields:`,
    `id (unique string), deck ("${deckName}"), topic (short string), source ("${sourceText ? "source" : "bank"}"), type ("mc" or "typed"), question (string), explanation (string).`,
    `For type "mc": also include options (array of EXACTLY 4 strings) and answerIndex (0-3).`,
    `For type "typed": also include answer (the expected short answer string).`,
    `Do not include any prose outside the JSON array.`
  ].filter(Boolean).join("\n\n");
}

function extractJsonArray(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseQuestionsJson(raw, deckName) {
  const arr = extractJsonArray(raw);
  if (!Array.isArray(arr)) {
    throw new Error("provider response contained no JSON array");
  }
  const valid = [];
  for (const item of arr) {
    const q = { ...item };
    if (!q.deck) q.deck = deckName;
    if (validateQuestion(q).valid) valid.push(q);
  }
  if (valid.length === 0) {
    throw new Error("no valid questions in provider response");
  }
  return valid;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: engine prompt/parse tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.js test/core/engine.test.js
git commit -m "feat(core): engine prompt building + JSON parsing"
```

---

### Task 10: Claude provider (fetch injected)

**Files:**
- Create: `src/core/providers/claude.js`
- Test: `test/core/providers/claude.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/providers/claude.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeProvider } from "../../../src/core/providers/claude.js";

function fakeFetch(responseText, capture = {}) {
  return async (url, opts) => {
    capture.url = url;
    capture.body = JSON.parse(opts.body);
    capture.headers = opts.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: responseText }] })
    };
  };
}

test("generateQuestions returns raw model text and calls messages endpoint", async () => {
  const cap = {};
  const provider = createClaudeProvider({
    apiKey: "sk-test", model: "claude-haiku-4-5-20251001",
    fetchImpl: fakeFetch("[]", cap)
  });
  const raw = await provider.generateQuestions({
    deckName: "ap-chem", sourceText: "x", focusTopics: [], count: 5, answerMode: "mc"
  });
  assert.equal(raw, "[]");
  assert.ok(cap.url.includes("/v1/messages"));
  assert.equal(cap.headers["x-api-key"], "sk-test");
  assert.ok(cap.body.messages[0].content.includes("ap-chem"));
});

test("gradeTyped parses correctness JSON from model", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m",
    fetchImpl: fakeFetch('{"correct": true, "feedback": "nice"}')
  });
  const r = await provider.gradeTyped({
    question: { question: "Avogadro?", answer: "6.022e23" }, userAnswer: "6.022e23"
  });
  assert.equal(r.correct, true);
  assert.equal(r.feedback, "nice");
});

test("hint returns trimmed model text", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m", fetchImpl: fakeFetch("  think about moles  ")
  });
  const h = await provider.hint({
    question: { question: "q" }, sourceText: ""
  });
  assert.equal(h, "think about moles");
});

test("throws a friendly error when API returns non-ok", async () => {
  const provider = createClaudeProvider({
    apiKey: "k", model: "m",
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "unauthorized" })
  });
  await assert.rejects(
    () => provider.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" }),
    /Claude API error 401/
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `providers/claude.js`.

- [ ] **Step 3: Implement `src/core/providers/claude.js`**

```js
import { buildGenerationPrompt } from "../engine.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

async function callClaude({ apiKey, model, fetchImpl, prompt, maxTokens = 4096 }) {
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

export function createClaudeProvider({ apiKey, model, fetchImpl = globalThis.fetch }) {
  return {
    async generateQuestions(opts) {
      const prompt = buildGenerationPrompt(opts);
      return callClaude({ apiKey, model, fetchImpl, prompt });
    },
    async gradeTyped({ question, userAnswer }) {
      const prompt = [
        `Grade this short answer. Question: "${question.question}".`,
        `Expected answer: "${question.answer}". Student answer: "${userAnswer}".`,
        `Reply ONLY with JSON: {"correct": true|false, "feedback": "one short sentence"}.`
      ].join("\n");
      const raw = await callClaude({ apiKey, model, fetchImpl, prompt, maxTokens: 256 });
      const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return { correct: !!parsed.correct, feedback: String(parsed.feedback ?? "") };
    },
    async hint({ question, sourceText }) {
      const prompt = [
        `Give ONE short hint (not the answer) for this question: "${question.question}".`,
        sourceText ? `Context:\n${sourceText.slice(0, 1500)}` : "",
        `Reply with just the hint sentence.`
      ].filter(Boolean).join("\n");
      const raw = await callClaude({ apiKey, model, fetchImpl, prompt, maxTokens: 128 });
      return raw.trim();
    }
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: claude provider tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/providers/claude.js test/core/providers/claude.test.js
git commit -m "feat(core): Claude provider"
```

---

### Task 11: Ollama provider (fetch injected)

**Files:**
- Create: `src/core/providers/ollama.js`
- Test: `test/core/providers/ollama.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/providers/ollama.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOllamaProvider } from "../../../src/core/providers/ollama.js";

function fakeFetch(responseText, capture = {}) {
  return async (url, opts) => {
    capture.url = url;
    capture.body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ response: responseText }) };
  };
}

test("generateQuestions posts to /api/generate and returns response text", async () => {
  const cap = {};
  const provider = createOllamaProvider({
    model: "llama3.2", host: "http://localhost:11434", fetchImpl: fakeFetch("[]", cap)
  });
  const raw = await provider.generateQuestions({
    deckName: "apush", sourceText: "", focusTopics: [], count: 3, answerMode: "both"
  });
  assert.equal(raw, "[]");
  assert.ok(cap.url.endsWith("/api/generate"));
  assert.equal(cap.body.model, "llama3.2");
  assert.equal(cap.body.stream, false);
});

test("throws friendly error when Ollama unreachable", async () => {
  const provider = createOllamaProvider({
    model: "llama3.2", host: "http://localhost:11434",
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); }
  });
  await assert.rejects(
    () => provider.generateQuestions({ deckName: "d", sourceText: "", focusTopics: [], count: 1, answerMode: "mc" }),
    /Ollama not reachable/
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `providers/ollama.js`.

- [ ] **Step 3: Implement `src/core/providers/ollama.js`**

```js
import { buildGenerationPrompt } from "../engine.js";

async function callOllama({ host, model, fetchImpl, prompt }) {
  let res;
  try {
    res = await fetchImpl(`${host}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false })
    });
  } catch (err) {
    throw new Error(`Ollama not reachable at ${host}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}`);
  }
  const data = await res.json();
  return (data.response ?? "").trim();
}

export function createOllamaProvider({ model, host = "http://localhost:11434", fetchImpl = globalThis.fetch }) {
  return {
    async generateQuestions(opts) {
      return callOllama({ host, model, fetchImpl, prompt: buildGenerationPrompt(opts) });
    },
    async gradeTyped({ question, userAnswer }) {
      const prompt = [
        `Grade this short answer. Question: "${question.question}".`,
        `Expected: "${question.answer}". Student: "${userAnswer}".`,
        `Reply ONLY JSON: {"correct": true|false, "feedback": "short"}.`
      ].join("\n");
      const raw = await callOllama({ host, model, fetchImpl, prompt });
      const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return { correct: !!parsed.correct, feedback: String(parsed.feedback ?? "") };
      } catch {
        return { correct: false, feedback: "Couldn't grade that one — try rephrasing." };
      }
    },
    async hint({ question, sourceText }) {
      const prompt = `Give ONE short hint (not the answer) for: "${question.question}".`;
      return (await callOllama({ host, model, fetchImpl, prompt })).trim();
    }
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: ollama provider tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/providers/ollama.js test/core/providers/ollama.test.js
git commit -m "feat(core): Ollama provider"
```

---

### Task 12: Engine — daily batch orchestration

**Files:**
- Modify: `src/core/engine.js` (add `generateDailyBatch` + `distributeCounts`)
- Test: `test/core/engine-batch.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/engine-batch.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { distributeCounts, generateDailyBatch } from "../../src/core/engine.js";

test("distributeCounts splits total across decks as evenly as possible", () => {
  assert.deepEqual(distributeCounts(10, 3), [4, 3, 3]);
  assert.deepEqual(distributeCounts(10, 2), [5, 5]);
  assert.deepEqual(distributeCounts(2, 5), [1, 1, 0, 0, 0]);
});

function fakeProvider(makeRaw) {
  return {
    async generateQuestions({ deckName, count }) {
      const items = Array.from({ length: count }, (_, i) => ({
        id: `${deckName}-${i}`, deck: deckName, topic: "T", source: "bank",
        type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0,
        explanation: "e"
      }));
      return makeRaw ? makeRaw(deckName, items) : JSON.stringify(items);
    }
  };
}

test("generateDailyBatch aggregates questions across decks up to total", async () => {
  const decks = [
    { deck: "ap-chem", mode: "bank", text: "" },
    { deck: "apush", mode: "bank", text: "" }
  ];
  const batch = await generateDailyBatch({
    decks, provider: fakeProvider(), count: 6, topicStats: {}, answerMode: "mc"
  });
  assert.equal(batch.length, 6);
  const decksSeen = new Set(batch.map(q => q.deck));
  assert.deepEqual([...decksSeen].sort(), ["ap-chem", "apush"]);
});

test("generateDailyBatch skips a failing deck but still returns others", async () => {
  const decks = [
    { deck: "good", mode: "bank", text: "" },
    { deck: "bad", mode: "bank", text: "" }
  ];
  const provider = {
    async generateQuestions({ deckName, count }) {
      if (deckName === "bad") throw new Error("provider down for bad");
      const items = Array.from({ length: count }, (_, i) => ({
        id: `good-${i}`, deck: "good", topic: "T", source: "bank",
        type: "mc", question: "q", options: ["a","b","c","d"], answerIndex: 0, explanation: "e"
      }));
      return JSON.stringify(items);
    }
  };
  const batch = await generateDailyBatch({ decks, provider, count: 4, topicStats: {}, answerMode: "mc" });
  assert.ok(batch.length > 0);
  assert.ok(batch.every(q => q.deck === "good"));
});

test("generateDailyBatch throws if every deck fails", async () => {
  const decks = [{ deck: "x", mode: "bank", text: "" }];
  const provider = { async generateQuestions() { throw new Error("down"); } };
  await assert.rejects(
    () => generateDailyBatch({ decks, provider, count: 3, topicStats: {}, answerMode: "mc" }),
    /could not generate any questions/i
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `distributeCounts`/`generateDailyBatch` not exported.

- [ ] **Step 3: Add to `src/core/engine.js`**

Append these exports (keep existing `buildGenerationPrompt`, `parseQuestionsJson`):
```js
import { weakTopics } from "./topics.js"; // add to existing imports at top of file

export function distributeCounts(total, n) {
  const base = Math.floor(total / n);
  const extra = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export async function generateDailyBatch({ decks, provider, count, topicStats, answerMode }) {
  if (decks.length === 0) throw new Error("no active decks");
  const counts = distributeCounts(count, decks.length);
  const focusByDeck = {};
  for (const w of weakTopics(topicStats, 20)) {
    (focusByDeck[w.deck] ??= []).push(w.topic);
  }
  const batch = [];
  for (let i = 0; i < decks.length; i++) {
    const deck = decks[i];
    const want = counts[i];
    if (want === 0) continue;
    try {
      const raw = await provider.generateQuestions({
        deckName: deck.deck,
        sourceText: deck.text,
        focusTopics: focusByDeck[deck.deck] ?? [],
        count: want,
        answerMode
      });
      const qs = parseQuestionsJson(raw, deck.deck);
      batch.push(...qs.slice(0, want));
    } catch {
      // skip this deck; other decks may still produce questions
    }
  }
  if (batch.length === 0) {
    throw new Error("could not generate any questions from active decks");
  }
  return batch.slice(0, count);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: engine-batch tests PASS (and prior engine tests still pass).

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.js test/core/engine-batch.test.js
git commit -m "feat(core): daily batch orchestration across decks"
```

---

### Task 13: Scheduler — quiet hours, next question, hydration timing

**Files:**
- Create: `src/core/scheduler.js`
- Test: `test/core/scheduler.test.js`

- [ ] **Step 1: Write the failing tests**

`test/core/scheduler.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuietHours, nextUnanswered, isHydrationDue } from "../../src/core/scheduler.js";

test("isQuietHours handles overnight window (22 -> 7)", () => {
  assert.equal(isQuietHours(23, 22, 7), true);
  assert.equal(isQuietHours(3, 22, 7), true);
  assert.equal(isQuietHours(12, 22, 7), false);
  assert.equal(isQuietHours(7, 22, 7), false); // end exclusive
});

test("isQuietHours handles same-day window (1 -> 5)", () => {
  assert.equal(isQuietHours(3, 1, 5), true);
  assert.equal(isQuietHours(6, 1, 5), false);
});

test("nextUnanswered returns first question with no answered progress", () => {
  const batch = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const progress = { a: { answered: true, correct: true } };
  assert.equal(nextUnanswered(batch, progress).id, "b");
});

test("nextUnanswered returns null when all answered", () => {
  const batch = [{ id: "a" }];
  assert.equal(nextUnanswered(batch, { a: { answered: true } }), null);
});

test("isHydrationDue true after interval, false before", () => {
  const now = 1_000_000;
  const intervalMs = 60_000;
  assert.equal(isHydrationDue(now - 70_000, now, intervalMs), true);
  assert.equal(isHydrationDue(now - 10_000, now, intervalMs), false);
});

test("isHydrationDue true when never reminded (null)", () => {
  assert.equal(isHydrationDue(null, 1000, 60_000), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `scheduler.js`.

- [ ] **Step 3: Implement `src/core/scheduler.js`**

```js
// hour: 0-23. Window [startHour, endHour) with overnight wrap support.
export function isQuietHours(hour, startHour, endHour) {
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // overnight wrap (e.g. 22 -> 7)
  return hour >= startHour || hour < endHour;
}

export function nextUnanswered(batch, progress) {
  for (const q of batch) {
    if (!progress[q.id]?.answered) return q;
  }
  return null;
}

export function isHydrationDue(lastReminderTs, now, intervalMs) {
  if (lastReminderTs == null) return true;
  return now - lastReminderTs >= intervalMs;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: scheduler tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/scheduler.js test/core/scheduler.test.js
git commit -m "feat(core): scheduler (quiet hours, next question, hydration)"
```

---

## Definition of Done (Plan 1)

- `npm test` runs green across all modules (schema, storage, streak, topics, sources, decks, grader, engine, engine-batch, providers, scheduler).
- No Electron, DOM, or live-network dependency anywhere in `src/core/`.
- Every external boundary (network via `fetchImpl`, PDF via `pdfParser`) is injectable.
- The Electron layer (Plan 2) can `import` any of these modules and wire real `fetch`, real `pdf-parse`, and the real `papple-sources` path + `userData` state file.

## Self-Review (completed by author)

- **Spec coverage:** providers (Claude+Ollama) ✓, deck resolution files-vs-bank ✓, weak-topic weighting (engine focusTopics via topics.weakTopics) ✓, MC grading ✓, typed grading (provider.gradeTyped) ✓, hint (provider.hint) ✓, streak/score/topic tracking ✓ (scoring lives in dailyScores written by Electron layer using gradeMc results), storage w/ today-batch caching ✓, quiet hours + hydration timing ✓. UI/personality/sprite, real PDF wiring, packaging → Plans 2 & 4 (out of scope here, by design).
- **Naming consistency:** `generateQuestions/gradeTyped/hint` identical across both providers and consumed by `generateDailyBatch`; `buildGenerationPrompt` shared by both providers and engine; `weakTopics` shape `{key,deck,topic,rate}` consumed correctly in engine. ✓
- **Placeholders:** none — every step has complete code and exact commands.
