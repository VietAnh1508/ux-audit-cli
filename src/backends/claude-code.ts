import type { LlmBackend, LlmBackendRunOptions } from "./types.js";
import type { AppOverview } from "../types/index.js";

// v1 default backend — see docs/IMPLEMENTATION_PLAN.md Phase 1.
// Spawns `claude -p` non-interactively with --mcp-config pointing at @playwright/mcp
// (see src/browser/mcp-bridge.ts) and --allowedTools scoped to that server only.
export class ClaudeCodeBackend implements LlmBackend {
  readonly name = "claude-code";

  async isAvailable(): Promise<boolean> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
  }

  async runScenario(_options: LlmBackendRunOptions): Promise<void> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
  }

  async synthesizeReport(_findingsPaths: string[], _appOverview: AppOverview): Promise<unknown> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 2");
  }
}
