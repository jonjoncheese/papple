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
