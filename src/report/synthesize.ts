import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ScenarioFindingsSchema } from "../config/schema.js";
import { readValidateWithRetry, tryReadJson } from "../engine/findings-handoff.js";
import type { AppOverview, ScenarioFindings } from "../types/index.js";
import type { LlmBackend } from "../backends/types.js";
import { ReportSchema, SynthesisOutputSchema, type Report } from "./schema.js";

async function readScenarioFindings(findingsPaths: string[]): Promise<ScenarioFindings[]> {
  const attempts = await Promise.all(findingsPaths.map((findingsPath) => tryReadJson(findingsPath, ScenarioFindingsSchema)));

  const failures = attempts.filter((attempt): attempt is { success: false; error: string } => !attempt.success);
  if (failures.length > 0) {
    throw new Error(`Could not read scenario findings for report synthesis:\n${failures.map((f) => f.error).join("\n")}`);
  }

  return attempts
    .filter((attempt): attempt is { success: true; data: ScenarioFindings } => attempt.success)
    .map((attempt) => attempt.data);
}

// Cross-scenario dedup ("same element+dimension across scenarios") needs judgment,
// not string matching — kept as an LLM call, fed the app.json overview so severity
// reflects what the business optimizes for. See docs/UX_AUDIT_CLI_PLAN.md "Report synthesis"
// and Decision 6, docs/IMPLEMENTATION_PLAN.md Phase 2.
//
// The LLM is only asked for SynthesisOutputSchema's narrow shape (executive summary,
// cross-scenario findings, quick wins, feature suggestions) — `sections` and `appName`
// are assembled here from each scenario's already-validated ScenarioFindings (which is
// also ReportSectionSchema's exact shape, so no mapping step is needed), not re-authored
// by the model, so axe-derived findings can't be paraphrased or dropped.
export async function synthesizeReport(
  backend: LlmBackend,
  findingsPaths: string[],
  appOverview: AppOverview,
): Promise<Report> {
  const scenarioFindings = await readScenarioFindings(findingsPaths);

  const workDir = await mkdtemp(path.join(tmpdir(), "ux-audit-report-"));
  const outputPath = path.join(workDir, "report.json");

  try {
    const baseOptions = { scenarioFindings, appOverview, outputPath };
    await backend.synthesizeReport(baseOptions);

    const result = await readValidateWithRetry(outputPath, SynthesisOutputSchema, (error) =>
      backend.synthesizeReport({ ...baseOptions, previousValidationError: error }),
    );

    if (!result.success) {
      throw new Error(`Report synthesis JSON still failed validation after one retry:\n${result.error}`);
    }

    return ReportSchema.parse({
      appName: appOverview.name,
      sections: scenarioFindings,
      ...result.data,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
