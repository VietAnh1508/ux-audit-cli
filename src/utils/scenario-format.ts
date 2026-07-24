import type { ScenarioConfig } from "../types/index.js";

// Single-line detail string (no slug, no line breaks) — reused as-is by callers that
// need one terminal line, e.g. a @clack/prompts option `hint`.
export function formatScenarioDetail(scenario: ScenarioConfig): string {
  const details = [`viewport: ${scenario.viewport}`, `session: ${scenario.session}`];
  if (scenario.credentialsRef) details.push(`auth: ${scenario.credentialsRef}`);
  if (scenario.scenarioUrl) details.push(`url: ${scenario.scenarioUrl}`);
  if (scenario.output) details.push(`output: ${scenario.output}`);
  return details.join("  ");
}

export function formatScenarioSummary(scenario: ScenarioConfig): string {
  return `${scenario.slug}\n  ${formatScenarioDetail(scenario)}`;
}
