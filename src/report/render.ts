import type { Report } from "./schema.js";

// Templates copied from reference/ux-audit-skill/assets/ as a starting shape:
// Executive Summary -> High/Medium/Low impact -> Screen notes -> Quick wins ->
// Feature suggestions. See src/report/templates/{report-single,report-multi}.md
// and docs/IMPLEMENTATION_PLAN.md Phase 2.
export function renderMarkdown(_report: Report, _mode: "single" | "multi"): string {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 2");
}
