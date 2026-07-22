import { z } from "zod";

function caseInsensitiveEnum<const T extends [string, ...string[]]>(values: T) {
  return z.preprocess((value) => (typeof value === "string" ? value.toLowerCase() : value), z.enum(values));
}

export const AppOverviewSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string(),
  coreBusiness: z.string(),
  targetUsers: z.string(),
});

export const LlmBackendNameSchema = z.enum(["auto", "claude-code", "codex", "gemini-cli", "api"]);

export const AppConfigSchema = z.object({
  defaultGuideline: z.string().default("w3c"),
  concurrency: z.number().int().positive().default(2),
  outputDir: z.string().default("."),
  llmBackend: LlmBackendNameSchema.default("auto"),
});

export const ScenarioConfigSchema = z.object({
  slug: z.string(),
  scenarioUrl: z.string().url().optional(),
  credentialsRef: z.string().optional(),
  session: caseInsensitiveEnum(["fresh", "authenticated"]).default("fresh"),
  viewport: caseInsensitiveEnum(["desktop", "mobile"]).default("desktop"),
  output: z.string().optional(),
  steps: z.string(),
  selectorHint: z.string().optional(),
});

export const CredentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

// credentials.local.json shape: a map of credentialsRef -> Credentials.
export const CredentialsFileSchema = z.record(z.string(), CredentialsSchema);

export const GuidelineSchema = z.object({
  name: z.string(),
  axeTags: z.array(z.string()),
  customChecklist: z.array(z.string()).optional(),
});

export const FindingSchema = z.object({
  element: z.string(),
  dimension: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  observation: z.string(),
  suggestion: z.string(),
});

export const ScenarioFindingsSchema = z.object({
  scenarioSlug: z.string(),
  status: z.enum(["OK", "ERROR", "BLOCKED"]),
  findings: z.array(FindingSchema),
  notes: z.string().optional(),
});
