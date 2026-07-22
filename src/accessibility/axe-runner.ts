import type { Page } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type { AxeResults } from "axe-core";

export type AxeScanResult = AxeResults;

// Runs AxeBuilder directly against the shared page (not through the LLM), filtered
// by the selected guideline's axe tags (e.g. ["wcag22aa"] for the W3C default).
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 5, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function runAxeScan(page: Page, axeTags: string[]): Promise<AxeScanResult> {
  return new AxeBuilder({ page }).withTags(axeTags).analyze();
}
