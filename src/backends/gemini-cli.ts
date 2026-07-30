import type { LlmBackend, LlmBackendRunOptions, SynthesizeReportOptions } from "./types.js";

// Phase 4 backend — see docs/IMPLEMENTATION_PLAN.md Phase 4.
// Spawns `gemini --non-interactive --yolo --output-format json` with an mcpServers
// entry in .gemini/settings.json. Requires a cached OAuth session (headless mode
// can't do interactive browser OAuth) or env-var auth if nothing is cached.
export class GeminiCliBackend implements LlmBackend {
  readonly name = "gemini-cli";

  async isAvailable(): Promise<boolean> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }

  async runScenario(_options: LlmBackendRunOptions): Promise<void> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }

  async synthesizeReport(_options: SynthesizeReportOptions): Promise<void> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 4");
  }
}
