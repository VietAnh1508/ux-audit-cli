import type { LlmBackendName } from "../types/index.js";
import type { LlmBackend } from "./types.js";
import { ClaudeCodeBackend } from "./claude-code.js";
import { CodexBackend } from "./codex.js";
import { GeminiCliBackend } from "./gemini-cli.js";
import { ApiBackend } from "./api.js";

// "auto" preference order — tries installed, logged-in CLIs first, falls back to
// "api" only if ANTHROPIC_API_KEY is set and no CLI is available. See
// docs/UX_AUDIT_CLI_PLAN.md Decision 5 and docs/IMPLEMENTATION_PLAN.md Phase 0 (preflight check).
const AUTO_PREFERENCE_ORDER: readonly LlmBackend[] = [
  new ClaudeCodeBackend(),
  new CodexBackend(),
  new GeminiCliBackend(),
];

export async function resolveBackend(preferred: LlmBackendName): Promise<LlmBackend> {
  if (preferred === "auto") {
    for (const backend of AUTO_PREFERENCE_ORDER) {
      if (await backend.isAvailable()) return backend;
    }
    if (process.env["ANTHROPIC_API_KEY"]) return new ApiBackend();
    throw new Error(
      "No LLM backend available. Install and log in to Claude Code (`claude`), or set ANTHROPIC_API_KEY to use the api backend.",
    );
  }

  switch (preferred) {
    case "claude-code":
      return new ClaudeCodeBackend();
    case "codex":
      return new CodexBackend();
    case "gemini-cli":
      return new GeminiCliBackend();
    case "api":
      return new ApiBackend();
  }
}
