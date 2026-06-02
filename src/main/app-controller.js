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

  return { ensureTodayBatch, getNext };
}
