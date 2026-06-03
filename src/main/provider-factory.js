import { createClaudeProvider } from "../core/providers/claude.js";
import { createOllamaProvider } from "../core/providers/ollama.js";
import { createClaudeCodeProvider } from "../core/providers/claude-code.js";

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export function buildProvider(settings, { fetchImpl = globalThis.fetch } = {}) {
  if (settings.aiMode === "claude-code") {
    return createClaudeCodeProvider();
  }
  if (settings.aiMode === "claude") {
    return createClaudeProvider({
      apiKey: settings.apiKey,
      model: settings.claudeModel || DEFAULT_CLAUDE_MODEL,
      fetchImpl
    });
  }
  if (settings.aiMode === "ollama") {
    return createOllamaProvider({
      model: settings.ollamaModel || "qwen2.5:3b",
      fetchImpl
    });
  }
  throw new Error(`unknown ai mode: ${settings.aiMode}`);
}
