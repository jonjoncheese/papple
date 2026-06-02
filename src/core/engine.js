import { validateQuestion } from "./schema.js";

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
    `Do not include any prose outside the JSON array.`
  ].filter(Boolean).join("\n\n");
}

function extractJsonArray(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
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
    if (validateQuestion(q).valid) valid.push(q);
  }
  if (valid.length === 0) {
    throw new Error("no valid questions in provider response");
  }
  return valid;
}
