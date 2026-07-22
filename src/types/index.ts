export type LlmBackendName = "auto" | "claude-code" | "codex" | "gemini-cli" | "api";

export interface AppOverview {
  name: string;
  url: string;
  description: string;
  coreBusiness: string;
  targetUsers: string;
}

export interface AppConfig {
  defaultGuideline: string;
  concurrency: number;
  outputDir: string;
  llmBackend: LlmBackendName;
}

export interface ScenarioConfig {
  slug: string;
  scenarioUrl?: string;
  credentialsRef?: string;
  session: "fresh" | "authenticated";
  viewport: "desktop" | "mobile";
  output?: string;
  steps: string;
  selectorHint?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export type FindingStatus = "OK" | "ERROR" | "BLOCKED";

export interface Finding {
  element: string;
  dimension: string;
  severity: "high" | "medium" | "low";
  observation: string;
  suggestion: string;
}

export interface ScenarioFindings {
  scenarioSlug: string;
  status: FindingStatus;
  findings: Finding[];
  notes?: string;
}

export interface Guideline {
  name: string;
  axeTags: string[];
  customChecklist?: string[];
}
