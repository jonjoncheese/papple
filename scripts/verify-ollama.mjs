// One-off: verify the local Ollama model produces valid questions through
// Papple's real provider + engine path. Run: node scripts/verify-ollama.mjs
import { createOllamaProvider } from "../src/core/providers/ollama.js";
import { generateDailyBatch } from "../src/core/engine.js";

const provider = createOllamaProvider({ model: "llama3.2" });
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
