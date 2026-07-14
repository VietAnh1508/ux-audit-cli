import type { ScenarioFindings } from "../types/index.js";

// The agent writes findings JSON to a known path as its last step; we read + validate
// against ScenarioFindingsSchema, retrying once (re-prompting with the validation
// error) if it doesn't conform. See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 6.
export async function readAndValidateFindings(_path: string): Promise<ScenarioFindings> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}
