import type { AppOverview } from "../types/index.js";
import type { LlmBackend } from "../backends/types.js";
import type { Report } from "./schema.js";

// Cross-scenario dedup ("same element+dimension across scenarios") needs judgment,
// not string matching — kept as an LLM call, fed the app.json overview so severity
// reflects what the business optimizes for. See docs/UX_AUDIT_CLI_PLAN.md "Report synthesis"
// and Decision 6, docs/IMPLEMENTATION_PLAN.md Phase 2.
export async function synthesizeReport(
  _backend: LlmBackend,
  _findingsPaths: string[],
  _appOverview: AppOverview,
): Promise<Report> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 2");
}
