import { readFile } from "node:fs/promises";
import type { ZodType } from "zod";
import { formatZodIssues } from "../config/loader.js";
import { ScenarioFindingsSchema } from "../config/schema.js";
import type { LlmBackend, LlmBackendRunOptions } from "../backends/types.js";
import type { ScenarioFindings } from "../types/index.js";

export type ValidatedRead<T> = { success: true; data: T } | { success: false; error: string };

export async function tryReadJson<T>(filePath: string, schema: ZodType<T>): Promise<ValidatedRead<T>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    return { success: false, error: `could not read ${filePath}: ${(error as Error).message}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { success: false, error: `${filePath} is not valid JSON: ${(error as Error).message}` };
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatZodIssues(result.error) };
  }
  return { success: true, data: result.data };
}

// Generic "read JSON, validate against a schema, retry once" skeleton shared by
// runScenario's findings handoff (below) and report synthesis's handoff
// (src/report/synthesize.ts) — they diverge only in what happens on a *second*
// failure, which is why that part isn't in here. See
// docs/UX_AUDIT_CLI_PLAN.md Execution engine step 6 and docs/IMPLEMENTATION_PLAN.md Phase 2.
export async function readValidateWithRetry<T>(
  outputPath: string,
  schema: ZodType<T>,
  retry: (previousValidationError: string) => Promise<void>,
): Promise<ValidatedRead<T>> {
  const firstAttempt = await tryReadJson(outputPath, schema);
  if (firstAttempt.success) {
    return firstAttempt;
  }

  await retry(firstAttempt.error);

  return tryReadJson(outputPath, schema);
}

export async function readAndValidateFindings(
  backend: LlmBackend,
  runOptions: LlmBackendRunOptions,
): Promise<ScenarioFindings> {
  const result = await readValidateWithRetry(runOptions.findingsOutputPath, ScenarioFindingsSchema, (error) =>
    backend.runScenario({ ...runOptions, previousValidationError: error }),
  );
  if (result.success) {
    return result.data;
  }

  return {
    scenarioSlug: runOptions.scenario.slug,
    status: "ERROR",
    findings: [],
    screens: [],
    notes: `Findings JSON still failed validation after one retry:\n${result.error}`,
  };
}
