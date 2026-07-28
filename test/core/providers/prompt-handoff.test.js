import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPromptHandoffProvider,
  wrapHandoffPrompt,
  resolveHandoffSite,
  HANDOFF_SITES
} from "../../../src/core/providers/prompt-handoff.js";
import { parseQuestionsJson, buildCombinedPrompt } from "../../../src/core/engine.js";

test("wrapHandoffPrompt insists on a bare JSON array reply", () => {
  const wrapped = wrapHandoffPrompt("INNER PROMPT");
  assert.match(wrapped, /ONLY a JSON array/i);
  assert.match(wrapped, /INNER PROMPT/);
  assert.ok(wrapped.indexOf("INNER PROMPT") > wrapped.indexOf("Papple"));
});

test("resolveHandoffSite falls back to ChatGPT", () => {
  assert.equal(resolveHandoffSite("chatgpt").url, HANDOFF_SITES.chatgpt.url);
  assert.equal(resolveHandoffSite("nope").id, "chatgpt");
  assert.equal(resolveHandoffSite("claude").label, "Claude");
});

test("createPromptHandoffProvider complete sends wrapped prompt through handoff", async () => {
  const seen = [];
  const p = createPromptHandoffProvider({
    handoff: async (prompt) => { seen.push(prompt); return "[]"; }
  });
  await p.complete("MAKE QUESTIONS");
  assert.equal(seen.length, 1);
  assert.match(seen[0], /MAKE QUESTIONS/);
  assert.match(seen[0], /JSON array/i);
});

test("createPromptHandoffProvider without handoff throws at construction", () => {
  assert.throws(() => createPromptHandoffProvider({}), /handoff/i);
});

test("handoff gradeTyped is local (no second website trip)", async () => {
  const p = createPromptHandoffProvider({ handoff: async () => "[]" });
  const ok = await p.gradeTyped({ question: { answer: "Avogadro" }, userAnswer: "avogadro" });
  assert.equal(ok.correct, true);
  const bad = await p.gradeTyped({ question: { answer: "Avogadro" }, userAnswer: "mole" });
  assert.equal(bad.correct, false);
});

test("parseQuestionsJson accepts a ChatGPT-style fenced paste", () => {
  const paste = [
    "Sure! Here are your questions:",
    "```json",
    JSON.stringify([{
      id: "q1", deck: "chem", topic: "moles", source: "ai", type: "mc",
      question: "What is Avogadro's number?",
      options: ["6.022e23", "3.14", "9.8", "1"],
      answerIndex: 0,
      explanation: "It is 6.022×10^23.",
      hint: "Think particles per mole."
    }]),
    "```",
    "Hope that helps!"
  ].join("\n");
  const qs = parseQuestionsJson(paste, "chem");
  assert.equal(qs.length, 1);
  assert.match(qs[0].question, /Avogadro/i);
});

test("buildCombinedPrompt grows with avoid-list (ever-growing handoff prompt)", () => {
  const decks = [{ deck: "chem", text: "Avogadro is 6.022e23." }];
  const small = buildCombinedPrompt({ decks, counts: [2], answerMode: "mc", avoid: [] });
  const big = buildCombinedPrompt({
    decks, counts: [2], answerMode: "mc",
    avoid: ["What is a mole?", "Define molarity.", "Name a strong acid."]
  });
  assert.ok(big.length > small.length);
  assert.match(big, /Do NOT repeat/i);
  assert.match(big, /What is a mole/);
});
