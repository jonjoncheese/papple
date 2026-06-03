import { validateQuestion } from "./schema.js";
import { weakTopics } from "./topics.js";

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
    `Quality rules: exactly ONE option must be correct and the other three clearly wrong (no "all of the above", no two correct options). Double-check that answerIndex points to the correct option. Keep questions factually accurate and at the level of the ${deckName} course. Always include a one-sentence explanation of why the answer is correct.`,
    `Do not include any prose outside the JSON array.`
  ].filter(Boolean).join("\n\n");
}

function extractJsonArray(raw) {
  const start = raw.indexOf("[");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
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
    if (!q.source) q.source = "ai";
    // Smaller models often omit the explanation — backfill a useful default
    // so otherwise-valid questions aren't dropped.
    if (!q.explanation) {
      if (q.type === "mc" && Array.isArray(q.options) && Number.isInteger(q.answerIndex)) {
        q.explanation = `The correct answer is "${q.options[q.answerIndex]}".`;
      } else if (q.answer) {
        q.explanation = `Expected answer: ${q.answer}`;
      } else {
        q.explanation = "—";
      }
    }
    if (validateQuestion(q).valid) valid.push(q);
  }
  if (valid.length === 0) {
    throw new Error("no valid questions in provider response");
  }
  return valid;
}

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
