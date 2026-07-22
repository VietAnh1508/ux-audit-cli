import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runAxeScan, type AxeScanResult } from "../accessibility/axe-runner.js";
import { resolveBackend } from "../backends/resolve.js";
import type { LlmBackendRunOptions } from "../backends/types.js";
import { checkUrlReachable, launchBrowser } from "../browser/launch.js";
import { startMcpBridge, stopMcpBridge, type McpBridge } from "../browser/mcp-bridge.js";
import { loadCredentials } from "../config/loader.js";
import type { AppConfig, AppOverview, Finding, ScenarioConfig, ScenarioFindings } from "../types/index.js";
import { readAndValidateFindings } from "./findings-handoff.js";

// Guideline presets (built-in variants, custom checklists) are Phase 3
// (src/commands/guideline.ts) — Phase 1 fixes the W3C default's axe tags directly.
const W3C_AXE_TAGS = ["wcag22aa"];

function severityForImpact(impact: AxeScanResult["violations"][number]["impact"]): Finding["severity"] {
  switch (impact) {
    case "critical":
    case "serious":
      return "high";
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

// One Finding per violation (not per affected node) to match the LLM findings' shape
// and avoid flooding the report with near-duplicates for a single rule.
function axeResultsToFindings(results: AxeScanResult): Finding[] {
  return results.violations.map((violation) => {
    const [firstNode, ...restNodes] = violation.nodes;
    const element = firstNode
      ? `${firstNode.target.join(" ")}${restNodes.length > 0 ? ` (+${restNodes.length} more)` : ""}`
      : violation.id;
    return {
      element,
      dimension: "Accessibility",
      severity: severityForImpact(violation.impact),
      observation: violation.description,
      suggestion: `${violation.help} (${violation.helpUrl})`,
    };
  });
}

function isSameOrigin(url: string, expectedUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(expectedUrl).origin;
  } catch {
    return false;
  }
}

function errorFindings(slug: string, notes: string): ScenarioFindings {
  return { scenarioSlug: slug, status: "ERROR", findings: [], notes };
}

// Per-scenario execution engine — see docs/UX_AUDIT_CLI_PLAN.md "Execution engine, per
// scenario" (steps 1-7) and docs/IMPLEMENTATION_PLAN.md Phase 1.
export interface RunScenarioOptions {
  headed?: boolean;
}

export async function runScenario(
  scenario: ScenarioConfig,
  appOverview: AppOverview,
  config: AppConfig,
  options: RunScenarioOptions = {},
): Promise<ScenarioFindings> {
  console.log("→ Checking LLM backend and app URL...");
  const backend = await resolveBackend(config.llmBackend);
  if (!(await backend.isAvailable())) {
    return errorFindings(
      scenario.slug,
      `LLM backend "${backend.name}" is not available — not installed, or not logged in.`,
    );
  }

  const url = scenario.scenarioUrl ?? appOverview.url;
  if (!(await checkUrlReachable(url))) {
    return errorFindings(scenario.slug, `${url} is not reachable.`);
  }

  const credentials = scenario.credentialsRef ? await loadCredentials(scenario.credentialsRef) : undefined;

  console.log(`→ Opening browser (${scenario.viewport})...`);
  const { browser, page, cdpEndpoint } = await launchBrowser(scenario.viewport, { headless: !options.headed });
  const userDataDir = await mkdtemp(path.join(tmpdir(), `ux-audit-${scenario.slug}-`));
  let bridge: McpBridge | undefined;

  try {
    console.log("→ Starting the accessibility bridge...");
    bridge = await startMcpBridge({ cdpEndpoint, userDataDir });

    const runOptions: LlmBackendRunOptions = {
      scenario,
      appOverview,
      url,
      credentials,
      mcpServerConfigPath: bridge.mcpConfigPath,
      findingsOutputPath: path.join(userDataDir, "findings.json"),
    };

    console.log(`→ Auditing in progress — ${backend.name} is walking the scenario...`);
    let llmFindings: ScenarioFindings;
    try {
      await backend.runScenario(runOptions);
      llmFindings = await readAndValidateFindings(backend, runOptions);
    } catch (error) {
      llmFindings = errorFindings(scenario.slug, `Backend "${backend.name}" failed: ${(error as Error).message}`);
    }

    if (llmFindings.status !== "OK") {
      return llmFindings;
    }

    // Shared-live-page guard (see docs/phases/phase-1-single-scenario.md Gotchas) — the
    // invariant that our axe scan and the agent's MCP tool calls drive the same `page`
    // only holds because browser_tabs/browser_resize are excluded from the backend's
    // allowlist. If something still spawned a second page (e.g. an auth popup), this
    // page handle would be stale — surface that as ERROR rather than scanning a
    // blank/wrong page.
    if (!isSameOrigin(page.url(), url)) {
      return errorFindings(
        scenario.slug,
        `Expected the shared page to be on ${new URL(url).origin} after the walk, but it was at ${page.url()}.`,
      );
    }

    console.log("→ Running accessibility scan...");
    const axeResults = await runAxeScan(page, W3C_AXE_TAGS);
    return { ...llmFindings, findings: [...llmFindings.findings, ...axeResultsToFindings(axeResults)] };
  } finally {
    console.log("→ Cleaning up...");
    if (bridge) await stopMcpBridge(bridge);
    await browser.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}
