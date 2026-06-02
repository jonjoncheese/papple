import { moodFor } from "./personality.js";
import { starterBatch } from "./starter-bank.js";

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "Claude if a key is set, otherwise fall back to local Ollama."
function effectiveSettings(s) {
  if (s.aiMode === "claude" && !s.apiKey) return { ...s, aiMode: "ollama" };
  return s;
}

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
    loadActiveDecks, buildProvider, generateDailyBatch,
    gradeMc, recordCompletion, recordAnswer,
    isHydrationDue, isQuietHours, nextUnanswered
  } = deps;

  async function ensureTodayBatch() {
    const state = await loadState(statePath);
    const today = isoDay(now());
    if (state.today.date === today && state.today.batch.length > 0) return state.today;

    // Try to generate from the active AI backend (Claude, or Ollama if no key).
    let batch = [];
    try {
      const decks = await loadActiveDecks(state.settings.activeDecks);
      const provider = buildProvider(effectiveSettings(state.settings));
      batch = await generateDailyBatch({
        decks, provider,
        count: state.settings.questionsPerDay,
        topicStats: state.topicStats,
        answerMode: state.settings.answerMode
      });
    } catch {
      batch = [];
    }

    // Final fallback: the built-in offline bank so Papple always has questions.
    if (!batch || batch.length === 0) {
      batch = starterBatch(state.settings.questionsPerDay, state.settings.answerMode);
    }

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
      let g;
      try {
        const provider = buildProvider(effectiveSettings(state.settings));
        g = await provider.gradeTyped({ question: q, userAnswer: typedAnswer ?? "" });
      } catch {
        g = localTypedGrade(q.answer, typedAnswer);
      }
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
    try {
      const provider = buildProvider(effectiveSettings(state.settings));
      return await provider.hint({ question: q, sourceText: "" });
    } catch {
      return `Think about the key idea behind "${q.topic}". You've got this 🍍`;
    }
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

  return { ensureTodayBatch, getNext, submitAnswer, getStatus, getHint, hydrationDue, markHydrated };
}
