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
