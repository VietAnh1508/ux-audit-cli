import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { LlmBackend, LlmBackendRunOptions } from "./types.js";
import type { AppOverview } from "../types/index.js";

const execFileAsync = promisify(execFile);

interface ClaudeAuthStatus {
  loggedIn: boolean;
}

// v1 default backend — see docs/IMPLEMENTATION_PLAN.md Phase 1.
// Spawns `claude -p` non-interactively with --mcp-config pointing at @playwright/mcp
// (see src/browser/mcp-bridge.ts) and --allowedTools scoped to that server only.
export class ClaudeCodeBackend implements LlmBackend {
  readonly name = "claude-code";

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("claude", ["auth", "status", "--json"], {
        timeout: 10_000,
      });
      const status = JSON.parse(stdout) as ClaudeAuthStatus;
      return status.loggedIn === true;
    } catch {
      // Covers both "claude" missing from PATH (ENOENT) and "not logged in" —
      // either way this backend isn't usable, so collapse both to false.
      return false;
    }
  }

  async runScenario(_options: LlmBackendRunOptions): Promise<void> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
  }

  async synthesizeReport(_findingsPaths: string[], _appOverview: AppOverview): Promise<unknown> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 2");
  }
}
