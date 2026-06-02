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
