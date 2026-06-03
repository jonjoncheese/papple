import { moodFor } from "./personality.js";

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function effectiveSettings(s) { return s; } // (kept for the call site; local fallback removed)

// Offline grading for typed answers when no AI backend is available.
function localTypedGrade(expected, given) {
  const norm = s => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
  const e = norm(expected), g = norm(given);
  const correct = g.length > 0 && (g === e || e.includes(g) || g.includes(e));
  return { correct, feedback: correct ? "correct! 🍍" : `expected: ${expected}` };
}

export function createController(deps) {
  const {
    loadState, saveState, statePath, now,
    loadActiveDecks, buildProvider, generateCombinedBatch,
    gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  } = deps;

  let inFlight = null; // de-dupes concurrent generation (launch pre-gen + a click)

  async function generateBatch(settings, topicStats, avoid = []) {
    const decks = await loadActiveDecks(settings.activeDecks);
    const provider = buildProvider(effectiveSettings(settings));
    // ONE provider call for the whole day's batch (subjects split in code).
    // `avoid` = recently-asked questions, so the AI writes fresh ones (no "bank" feel).
    return generateCombinedBatch({
      decks, provider,
      count: settings.questionsPerDay,
      topicStats,
      answerMode: settings.answerMode,
      avoid
    });
  }

  async function ensureTodayBatch() {
    const state = await loadState(statePath);
    const today = isoDay(now());
    if (state.today.date === today && state.today.batch.length > 0) return state.today;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        // Throws if no AI backend is reachable; caller surfaces a "set up your AI" message.
        const batch = await generateBatch(state.settings, state.topicStats, state.askedRecent || []);
        state.today = { date: today, batch, progress: {} };
        await saveState(statePath, state);
        return state.today;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function getNext() {
    await ensureTodayBatch();
    const state = await loadState(statePath);
    let q = nextUnanswered(state.today.batch, state.today.progress);
    // Endless mode: once the daily batch is exhausted, generate more — avoiding
    // both the recent history AND everything already in today's batch.
    if (!q && state.settings.endlessMode) {
      const avoid = [...(state.askedRecent || []), ...state.today.batch.map(b => b.question)];
      const more = await generateBatch(state.settings, state.topicStats, avoid);
      const stamp = Date.now();
      state.today.batch.push(...more.map((m, i) => ({ ...m, id: `${m.id}-x${stamp}-${i}` })));
      await saveState(statePath, state);
      q = nextUnanswered(state.today.batch, state.today.progress);
    }
    return q;
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
      // Local grading — instant, no Claude call per answer.
      const g = localTypedGrade(q.answer, typedAnswer);
      result = { correct: g.correct, explanation: q.explanation, feedback: g.feedback };
    }

    state.today.progress[id] = { answered: true, correct: result.correct };
    // Remember what's been asked so future batches don't repeat it (capped, newest-last).
    state.askedRecent = [...(state.askedRecent || []).filter(t => t !== q.question), q.question].slice(-80);
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
    // Hints are pre-generated with the batch — instant, no Claude call.
    return q.hint || `Think about the key idea behind "${q.topic}". You've got this 🍍`;
  }

  // End-of-set recap (NotebookLM-style): score, per-topic + per-source breakdown, and what you missed.
  async function getSummary() {
    const state = await loadState(statePath);
    const batch = state.today.batch || [];
    const prog = state.today.progress || {};
    const answered = batch.filter(q => prog[q.id]?.answered);
    const correct = answered.filter(q => prog[q.id]?.correct).length;
    const group = (keyFn) => {
      const m = {};
      for (const q of answered) {
        const k = keyFn(q) || "General";
        (m[k] ??= { name: k, correct: 0, total: 0 });
        m[k].total++; if (prog[q.id]?.correct) m[k].correct++;
      }
      return Object.values(m).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
    };
    const wrong = answered.filter(q => !prog[q.id]?.correct).map(q => ({
      question: q.question, topic: q.topic, deck: q.deck, source: q.source,
      answer: q.type === "mc" ? q.options?.[q.answerIndex] : q.answer,
      explanation: q.explanation
    }));
    return {
      answered: answered.length, correct, total: batch.length,
      byTopic: group(q => q.topic), bySource: group(q => q.deck || q.source), wrong
    };
  }

  // Dev/reset: wipe today's questions AND the asked-question memory, then
  // regenerate a fresh batch from scratch (proves there's no hidden "bank").
  async function resetQuestions() {
    const state = await loadState(statePath);
    state.today = { date: null, batch: [], progress: {} };
    state.askedRecent = [];
    await saveState(statePath, state);
    await ensureTodayBatch();
    return { ok: true };
  }

  async function hydrationDue() {
    const state = await loadState(statePath);
    if (!state.settings.hydration?.enabled) return false;
    const d = now();
    if (isQuietHours(d.getHours(), state.settings.quietStartHour, state.settings.quietEndHour)) return false;
    const intervalMs = state.settings.hydration.intervalMin * 60_000;
    return isHydrationDue(state.lastHydrationTs ?? null, d.getTime(), intervalMs);
  }

  async function markHydrated() {
    const state = await loadState(statePath);
    state.lastHydrationTs = now().getTime();
    await saveState(statePath, state);
  }

  return { ensureTodayBatch, getNext, submitAnswer, getStatus, getSummary, getHint, resetQuestions, hydrationDue, markHydrated };
}
