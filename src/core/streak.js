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
