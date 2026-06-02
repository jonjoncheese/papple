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
