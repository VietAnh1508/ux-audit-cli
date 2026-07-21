import { readFile } from "node:fs/promises";
import { formatZodIssues } from "../config/loader.js";
import { ScenarioFindingsSchema } from "../config/schema.js";
import type { LlmBackend, LlmBackendRunOptions } from "../backends/types.js";
import type { ScenarioFindings } from "../types/index.js";

type ReadAttempt = { success: true; data: ScenarioFindings } | { success: false; error: string };

async function tryReadFindings(findingsOutputPath: string): Promise<ReadAttempt> {
  let raw: string;
  try {
    raw = await readFile(findingsOutputPath, "utf-8");
  } catch (error) {
    return { success: false, error: `could not read ${findingsOutputPath}: ${(error as Error).message}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { success: false, error: `${findingsOutputPath} is not valid JSON: ${(error as Error).message}` };
  }

  const result = ScenarioFindingsSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatZodIssues(result.error) };
  }
  return { success: true, data: result.data };
}

// The agent writes findings JSON to a known path as its last step; we read + validate
// against ScenarioFindingsSchema, retrying once (re-prompting with the validation
// error) if it doesn't conform. See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 6.
export async function readAndValidateFindings(
  backend: LlmBackend,
  runOptions: LlmBackendRunOptions,
): Promise<ScenarioFindings> {
  const firstAttempt = await tryReadFindings(runOptions.findingsOutputPath);
  if (firstAttempt.success) {
    return firstAttempt.data;
  }

  await backend.runScenario({ ...runOptions, previousValidationError: firstAttempt.error });

  const secondAttempt = await tryReadFindings(runOptions.findingsOutputPath);
  if (secondAttempt.success) {
    return secondAttempt.data;
  }

  return {
    scenarioSlug: runOptions.scenario.slug,
    status: "ERROR",
    findings: [],
    notes: `Findings JSON still failed validation after one retry:\n${secondAttempt.error}`,
  };
}
