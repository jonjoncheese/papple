# Papple — Design Spec

**Date:** 2026-06-02 (revised same day with expanded direction)
**Owner:** chica
**Status:** Approved design, pre-implementation
**Deadline:** Ship a polished, demoable v1 by next week (~2026-06-09) for a
social-media showcase. Scope is cut hard to hit this; the larger vision is a
public roadmap teased in the showcase.

---

## 1. Summary

Papple is a cute desktop **companion** (study-first) — a pixel-art pineapple that
lives in the bottom-right corner and quizzes the user with **at least 10
questions a day** so they don't forget what they're studying. Questions come from
**decks** (per-subject), each fed by either the user's own files or a
Claude-generated question bank. A strong personality layer delivers every status,
error, and reaction in-character with a matching face/animation. v1 also includes
light **hydration/break reminders** to establish the "companion, not just a quiz
app" identity. Built on Electron, designed from day one to be packaged and sold.

**Content model (mixed):** the user drops real files into per-deck folders; any
deck with no/thin files uses a Claude-generated bank instead. v1 ships seeded
with the user's two real Sem2 finals reviews (chem + alg2/trig) plus generated
banks for the remaining decks.

---

## 2. Goals / Non-Goals

### Goals
- Adorable, animated, always-on-top corner buddy on Windows.
- 10 AI-generated questions/day from a user-controlled sources folder.
- Two answer formats (multiple choice + typed), user's choice.
- User-chosen pace: spread-out nudges OR one quiz session; click Papple to quiz now.
- Track streak, daily score, and weak topics (bias future questions toward weak topics).
- Rich personality: in-character lines for every state, plus reactions and mood.
- **Per-subject decks**, toggleable in Settings; daily questions drawn from active decks.
- **Mixed content**: user files per deck + Claude-generated banks for gaps.
- **Hydration/break reminders** (light) to seed the companion identity.
- Architected to be sellable: pluggable AI provider, configurable folder, settings UI, `.exe` packaging, no hardcoded personal paths.

### Non-Goals (v1)
- No cloud sync / accounts / multiplayer.
- No claude.ai subscription scraping (only API key or local Ollama).
- No mobile version.
- No licensing/payment system yet (selling is a later phase; v1 just stays clean enough to add it).
- No spaced-repetition algorithm beyond simple weak-topic weighting.
- **No self-researching / autonomous bank improvement** (roadmap — §11).
- **No SAT/ACT/AP exam-mode tailoring** as a dedicated feature (AP appears only as normal decks in v1; roadmap — §11).
- **No broad life-companion features** beyond study + hydration/break reminders (roadmap — §11).

---

## 3. Tech Stack

- **Electron** (Node + Chromium). One stack handles UI, file/PDF reading, Claude API calls, and local Ollama calls.
- **Pixel art** rendered on an HTML canvas / CSS sprites.
- **PDF parsing:** `pdf-parse` (or equivalent Node lib).
- **Packaging:** `electron-builder` → Windows `.exe` installer.
- **Storage:** local JSON file in Electron `userData`.

Rationale: fastest path to a genuinely cute, animated buddy; single language for
UI + AI + files; clean packaging for selling. Tauri is a possible later port if
install size ever matters.

---

## 4. Components

### 4.1 Buddy window
Transparent, frameless, always-on-top, click-through where empty. Shows pixel
Papple with idle/blink animation and **mood state** driven by streak + score.
- Click Papple → "quiz me now" (runs remaining questions).
- Right-click → menu: Settings, Pause for today, Quit.
- Draggable: user can reposition; Papple wobbles on drop; position persisted.

### 4.2 Quiz popup
Speech-bubble styled panel anchored near Papple. Renders the current question:
- **MC:** 4 buttons; click → instant local grade.
- **Typed:** text box → answer sent to AI grader.
- After answering: ✅/❌ + short explanation, then "next" or auto-advance.
- Optional **Hint button** (see 4.7) available before answering.

### 4.3 Settings window
- AI mode: **Claude (API key)** [default] or **Local (Ollama)**.
- Anthropic API key field.
- Pace: **nudge** (default) or **session**; nudge interval.
- Questions per day (default 10).
- Answer mode: MC / typed / both.
- Sources folder path (default `…/papple/papple-sources`).
- Quiet hours (start/end) for sleep mode.
- **Active decks** — toggle each subject deck on/off.
- **Hydration/break reminders** — on/off + interval.

### 4.4 Question engine (provider interface)
A single interface with swappable backends:
- `ClaudeProvider` — calls Anthropic API with the user's key.
- `OllamaProvider` — calls `http://localhost:11434`.

Responsibilities: given selected source text (weighted toward weak topics) and a
question count, return validated question JSON. Also grades typed answers
(returns correct/incorrect + feedback). The provider abstraction is the key
sellability seam.

### 4.5 Source loader + decks
The sources folder contains one subfolder per **deck** (subject). The loader
reads each active deck's files, parses `.md` and `.pdf` into clean text chunks
tagged by deck + source filename + (best-effort) topic. Skips files it can't
parse (reports in-character). Watches the folder for changes.

**Deck content resolution (mixed model):**
- Deck folder has usable files → generate questions from those files.
- Deck folder empty or thin → use a **Claude-generated bank** for that deck
  (banks are generated once and stored as files Papple reads like any source).

**v1 decks:** `hc-chem-sem1`, `hc-chem-sem2`, `math-alg2trig-sem1`,
`math-alg2trig-sem2`, `ap-chem`, `apush`, `ap-chinese`, `ap-seminar`. No APWH.
Each deck is independently toggled on/off in Settings; the daily 10 are drawn
across whatever decks are active.

### 4.6 Grader
- **MC:** graded instantly and locally against `answerIndex`.
- **Typed:** sent to the active AI provider, which judges correctness vs the
  expected answer and returns short feedback. (In local-Ollama mode, typed
  grading quality is weaker — acceptable, documented.)

### 4.7 Hint system
On a question, clicking Papple (in popup context) yields one hint — a nudge, not
the answer — generated by the active provider from the question + source. One
hint per question.

### 4.8 Storage
Single local JSON file:
- Settings (incl. active decks, hydration on/off + interval).
- Streak count + last-completed date.
- Per-day scores.
- Per-topic stats (times seen / times missed) → weak-topic weighting.
- Today's generated question batch + per-question progress (so restarts don't
  regenerate or re-charge the API).
- Buddy screen position.

### 4.9 Hydration / break reminders
A light, separate reminder track from quizzing. On an interval (configurable,
respecting quiet hours), Papple pops a quick in-character nudge ("sip some water
🥤", "stretch those legs!"). On/off in Settings. Deliberately minimal in v1 — it
exists to establish the companion identity and demo well, not to be a full
wellness system. Shares the popup + personality infrastructure with quizzing.

---

## 5. Data Flow

1. **New day (or first launch):** source loader reads folder → engine builds a
   prompt weighted toward weak topics → active provider returns N questions as
   JSON → validated → cached as today's batch in storage.
2. **Delivery:**
   - *Nudge mode:* a timer pops the next unanswered question every interval
     (respecting quiet hours).
   - *Session mode* or *clicking Papple:* runs the remaining questions
     back-to-back.
3. **Answer → grade → update** streak/score/topic stats → Papple mood updates →
   explanation shown.
4. **After the last question:** Papple celebrates; shows today's score + streak.

### Question JSON schema
```json
{
  "id": "string",
  "topic": "string",
  "source": "filename",
  "type": "mc | typed",
  "question": "string",
  "options": ["a", "b", "c", "d"],   // mc only
  "answerIndex": 0,                    // mc only
  "answer": "expected answer",         // typed only
  "explanation": "string"
}
```

---

## 6. Personality Layer (core feature, not polish)

Every state has a face/animation + an in-character line. Errors always state
**what's wrong AND how to fix it**, in Papple's voice.

### Status & error states
| State | Papple does | Papple says |
|---|---|---|
| Generating today's questions | spinny swirl eyes 🌀 | "brewing your questions… hang tight 🍍" |
| AI unreachable | spinny eyes + sweat drop | "my brain's buffering… *(can't reach Claude / local AI — check internet or your key in Settings)*" |
| No API key | empty thought bubble | "I need a brain to think! Paste your Claude key in Settings 🔑" |
| PDF won't parse | confused squint | "I can't read **[filename]** — looks like a scanned image. Save it as a text PDF or drop a .md and I'll get it!" |
| Empty sources folder | hungry look-around | "feed me notes! Drop PDFs in your papple-sources folder 🍍" |
| Ollama not running (local mode) | tiny hard-hat | "local-brain mode needs Ollama running — start it, or switch me to Claude in Settings" |

### Reactions
| Moment | Papple |
|---|---|
| Correct answer | happy bounce, leaves perk — rotating: "Yesss! 🍍✨" / "nailed it!" / "ooh you *know* this" |
| Wrong answer | gentle droop, never mean — "aw, so close! here's the trick: …" |
| 10/10 day | confetti + party-leaf — "PERFECT. I'm so proud I could sprout 🎉" |
| Streak milestone (3 / 7 / 30 days) | party hat, glow — "🔥 7 days straight! you're unstoppable" |
| Missed yesterday | wilted leaf crown, droopy — "I missed you yesterday… let's get back to it 🥺" |
| Ignored w/ questions left | thought-bubble peek — "psst… 3 left 👀" |

### Mood states (drive idle sprite)
- **Happy** — streak alive, recent good scores.
- **Neutral** — default idle.
- **Sad/droopy** — missed a day or low recent scores.

### v1 personality extras (all approved)
1. **Draggable + wobble** — reposition Papple anywhere; wobble on drop; position remembered.
2. **Quiet hours / sleep** — Papple dozes (💤) during user-set night hours; no nudges; wakes in the morning.
3. **Idle chatter** — occasional thought bubble when ignored ("psst… questions waiting 👀", random cute musings).
4. **Hint button** — one AI-generated hint per question on demand.

---

## 7. Error Handling Principles

- Every failure surfaces as a friendly, in-character Papple message **with a fix**.
- AI/provider unreachable → fall back to today's cached batch if present, else a
  tiny built-in starter question set; show the "buffering" state.
- Unparseable file → skip, keep going, name the file in-character.
- Empty/missing sources folder → prompt the user to add notes.
- Missing/invalid API key → point to Settings.

---

## 8. Testing

Unit tests on logic-bearing parts (AI calls mocked):
- **Source loader:** md/pdf → chunks; skips bad files.
- **Engine:** prompt building; JSON parse + schema validation; weak-topic weighting.
- **Grader:** MC correctness; typed-answer grading path (mocked provider).
- **Storage:** streak math (consecutive days, reset on miss), per-topic stats, batch caching.

Manual verification: buddy window behavior (always-on-top, transparent,
draggable), popup rendering, tray/menu, quiet-hours sleep, mood transitions.

---

## 9. Project Layout & Locations

- App project: `C:\Users\chica\papple\`
- Sources folder (user-controlled): `C:\Users\chica\papple\papple-sources\`
- User data (storage JSON): Electron `userData` dir.
- Spec: `docs/superpowers/specs/2026-06-02-papple-design.md`

No hardcoded personal paths in shipped code — sources folder and key are
configurable via Settings.

---

## 10. Sellability + Monetization (later phase, not v1 work)

Already designed-in: provider abstraction (Claude / Ollama / future pre-gen
bank), configurable sources folder, full settings UI, `.exe` packaging. Selling
later = add licensing + onboarding polish, not a rewrite.

**Monetization model (chica's intent):** freemium.
- **Free tier** — the Papple buddy + study quizzing works for free, using the
  user's own AI (bring-your-own Claude API key, or local Ollama). The core
  experience is free.
- **Paid tier (subscription OR one-time payment)** — unlocks **unlimited
  updates** and the broader **general companion** features (the roadmap items:
  self-researching banks, SAT/ACT/AP exam modes, the wider life-companion
  layer). Likely also a "managed" option where Papple's questions are generated
  via a hosted backend so the buyer needs no API key of their own.
- The provider abstraction already supports the key split here: free = BYO-key /
  local; paid/managed = hosted generation. Licensing/payment is a post-v1 add,
  not a rewrite.

No GitHub remote yet — when publishing, create a fresh repo under chica's own
account (current local commits are authored chicagoyoyo@gmail.com; confirm that
is chica's before any push).

---

## 11. Roadmap (post-v1 — the showcase teaser)

Deliberately cut from v1 to hit the deadline; these are what Papple grows into:
- **Self-researching banks** — Papple autonomously researches the web to expand
  and improve its question banks for a subject over time.
- **Exam-mode tailoring** — dedicated SAT / ACT / AP exam prep modes (timing,
  format, scoring that mirrors the real exams) rather than plain decks.
- **Full life-companion** — reminders/features beyond study + hydration (tasks,
  encouragement, routines), making Papple an overall daily companion.
- **Possible Tauri port** if install size matters for distribution.

---

## 12. v1 Delivery Checklist (deadline ~2026-06-09)

- [ ] Custom pixel-art Papple sprite (idle/blink + happy/neutral/sad/sleep + spinny-eyes), designed in visual companion.
- [ ] Buddy window (transparent, always-on-top, draggable, tray menu).
- [ ] Quiz popup (MC + typed, feedback, hint).
- [ ] Question engine w/ ClaudeProvider (default) + OllamaProvider; deck-aware generation.
- [ ] Source loader + deck resolution (files vs generated bank).
- [ ] Generated question banks for empty decks (Sem1 chem, Sem1 math, AP Chem, APUSH, AP Chinese, AP Seminar).
- [ ] Tracking (streak/score/weak-topic) + storage.
- [ ] Settings UI (key, AI mode, pace, quiet hours, decks, hydration).
- [ ] Personality layer (all states/reactions/moods) + 4 extras (drag, sleep, idle chatter, hint).
- [ ] Hydration/break reminders.
- [ ] Package to `.exe` installer.
- [ ] Showcase assets (recording Papple in action + roadmap teaser).
