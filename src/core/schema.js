export const QUESTION_TYPES = ["mc", "typed"];

const COMMON_FIELDS = ["id", "deck", "topic", "source", "type", "question", "explanation"];

export function validateQuestion(q) {
  const errors = [];
  if (q == null || typeof q !== "object") {
    return { valid: false, errors: ["question is not an object"] };
  }
  for (const f of COMMON_FIELDS) {
    if (typeof q[f] !== "string" || q[f].length === 0) {
      errors.push(`missing/empty field: ${f}`);
    }
  }
  if (!QUESTION_TYPES.includes(q.type)) {
    errors.push(`invalid type: ${q.type}`);
  }
  if (q.type === "mc") {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push("mc requires exactly 4 options");
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 ||
        (Array.isArray(q.options) && q.answerIndex >= q.options.length)) {
      errors.push("mc answerIndex out of range");
    }
  }
  if (q.type === "typed") {
    if (typeof q.answer !== "string" || q.answer.length === 0) {
      errors.push("typed requires non-empty answer");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidQuestion(q) {
  const { valid, errors } = validateQuestion(q);
  if (!valid) throw new Error(`Invalid question: ${errors.join("; ")}`);
  return q;
}
