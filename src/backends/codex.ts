import type { LlmBackend, LlmBackendRunOptions } from "./types.js";
import type { AppOverview } from "../types/index.js";

// Phase 4 backend — see docs/IMPLEMENTATION_PLAN.md Phase 4.
// Spawns `codex exec` with an MCP server entry in .codex/config.toml.
// Caveat carried from docs/UX_AUDIT_CLI_PLAN.md Open risks: OpenAI's own docs recommend
// API-key auth (not ChatGPT sign-in) specifically for CI/CD use of this backend.
export class CodexBackend implements LlmBackend {
  readonly name = "codex";

  async isAvailable(): Promise<boolean> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }

  async runScenario(_options: LlmBackendRunOptions): Promise<void> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }

  async synthesizeReport(_findingsPaths: string[], _appOverview: AppOverview): Promise<unknown> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }
}
