export function gradeMc(question, selectedIndex) {
  if (question.type !== "mc") {
    throw new Error("gradeMc called on non-mc question");
  }
  return {
    correct: selectedIndex === question.answerIndex,
    correctIndex: question.answerIndex,
    explanation: question.explanation
  };
}
