import { z } from "zod";

export const AppOverviewSchema = z.object({
  name: z.string(),
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
  appUrl: z.string().url(),
  appName: z.string(),
  appPersona: z.string(),
  credentialsRef: z.string().optional(),
  session: z.enum(["fresh", "authenticated"]).default("fresh"),
  viewport: z.enum(["desktop", "mobile"]).default("desktop"),
  output: z.string().optional(),
  steps: z.string(),
  selectorHint: z.string().optional(),
});

export const CredentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

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
