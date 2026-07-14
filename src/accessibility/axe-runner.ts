import type { Page } from "playwright";

// Return type matches AxeBuilder#analyze()'s AxeResults — left as `unknown` here to
// avoid a direct type dependency on axe-core; narrow this once Phase 1 wires up
// @axe-core/playwright's AxeBuilder for real.
export type AxeScanResult = unknown;

// Runs AxeBuilder directly against the shared page (not through the LLM), filtered
// by the selected guideline's axe tags (e.g. ["wcag22aa"] for the W3C default).
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 5, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function runAxeScan(_page: Page, _axeTags: string[]): Promise<AxeScanResult> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}
