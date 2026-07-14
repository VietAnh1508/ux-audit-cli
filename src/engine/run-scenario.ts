import type { AppConfig, AppOverview, ScenarioConfig, ScenarioFindings } from "../types/index.js";

// Per-scenario execution engine — see docs/UX_AUDIT_CLI_PLAN.md "Execution engine, per
// scenario" (steps 1-7) and docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function runScenario(
  _scenario: ScenarioConfig,
  _appOverview: AppOverview,
  _config: AppConfig,
): Promise<ScenarioFindings> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}
