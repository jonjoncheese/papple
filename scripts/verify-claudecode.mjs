// Verify the Claude Code provider generates valid questions through the real
// `claude -p` CLI. Run: node scripts/verify-claudecode.mjs
import { createClaudeCodeProvider } from "../src/core/providers/claude-code.js";
import { generateDailyBatch } from "../src/core/engine.js";

const provider = createClaudeCodeProvider();
const t0 = Date.now();
try {
  const batch = await generateDailyBatch({
    decks: [{ deck: "Chemistry", mode: "bank", text: "" }],
    provider, count: 3, topicStats: {}, answerMode: "mc"
  });
  console.log(`OK — ${batch.length} valid questions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const q of batch) {
    console.log(`\n[${q.topic}] ${q.question}`);
    q.options?.forEach((o, i) => console.log(`  ${i === q.answerIndex ? "*" : " "} ${o}`));
  }
} catch (e) {
  console.log("FAIL:", e.message);
}
