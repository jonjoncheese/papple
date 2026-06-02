import { createOllamaProvider } from "../src/core/providers/ollama.js";
const provider = createOllamaProvider({ model: "llama3.2" });
const raw = await provider.generateQuestions({
  deckName: "Chemistry", sourceText: "", focusTopics: [], count: 3, answerMode: "mc"
});
console.log("=== RAW OLLAMA OUTPUT ===");
console.log(raw);
console.log("=== END (" + raw.length + " chars) ===");
