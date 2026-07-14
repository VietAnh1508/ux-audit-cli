import type { LlmBackend, LlmBackendRunOptions } from "./types.js";
import type { AppOverview } from "../types/index.js";

// Opt-in backend for CI/headless environments with no pre-authenticated CLI — see
// docs/IMPLEMENTATION_PLAN.md Phase 4. Uses @anthropic-ai/sdk's `toolRunner` + `betaZodTool`
// over the same Playwright tool set, and `zodOutputFormat` for structured findings
// (the only backend where schema conformance is SDK-enforced, not file-handoff-validated).
export class ApiBackend implements LlmBackend {
  readonly name = "api";

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
