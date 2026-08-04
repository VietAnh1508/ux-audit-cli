// Manual acceptance check for docs/phases/phase-2-multi-scenario.md section 2's concurrency
// pool — specifically the plan's "confirm this holds under real concurrent load" note about
// launchBrowser()/mcp-bridge.ts's free-port + userDataDir isolation. Runs several real browsers
// + real mcp-bridge subprocesses through runScenario() concurrently via p-limit, but with a fake
// LlmBackend (no real `claude -p` subprocess, no cost) that just writes a canned findings.json
// immediately — isolating the concurrency plumbing from the LLM call.
//
// Run with: ./node_modules/.bin/tsx test/manual/concurrent-run-scenario.ts
//
// The fake backend never actually drives the page (no MCP tool calls), so every scenario is
// expected to end ERROR at runScenario's same-origin guard (page stuck on about:blank) — that's
// not what this check is verifying. What matters: no port or userDataDir collision crashes, and
// the "active" counter never exceeds the concurrency limit.
import { writeFile } from "node:fs/promises";
import pLimit from "p-limit";
import type { LlmBackend, LlmBackendRunOptions, SynthesizeReportOptions } from "../../src/backends/types.js";
import { runScenario } from "../../src/engine/run-scenario.js";
import type { AppOverview, ScenarioConfig, ScenarioFindings } from "../../src/types/index.js";

const SCENARIO_COUNT = 5;
const CONCURRENCY = 2;

const appOverview: AppOverview = {
  name: "Example",
  url: "https://example.com",
  description: "A placeholder site used for IANA example domains.",
  coreBusiness: "N/A",
  targetUsers: "N/A",
};

let active = 0;
let maxActive = 0;

class FakeBackend implements LlmBackend {
  readonly name = "fake";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async runScenario(options: LlmBackendRunOptions): Promise<void> {
    active++;
    maxActive = Math.max(maxActive, active);
    console.log(`[${options.scenario.slug}] fake backend running (active=${active})`);
    // Simulate walk time so overlapping runs actually overlap instead of finishing sequentially
    // fast enough to never contend for a port.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const findings: ScenarioFindings = {
      scenarioSlug: options.scenario.slug,
      status: "OK",
      findings: [],
      screens: [],
    };
    await writeFile(options.findingsOutputPath, JSON.stringify(findings), "utf-8");
    active--;
  }

  async synthesizeReport(_options: SynthesizeReportOptions): Promise<void> {
    throw new Error("not used by this check");
  }
}

const scenarios: ScenarioConfig[] = Array.from({ length: SCENARIO_COUNT }, (_, index) => ({
  slug: `scenario-${index}`,
  session: "fresh",
  viewport: index % 2 === 0 ? "desktop" : "mobile",
  steps: "Load the page and do nothing else.",
}));

const backend = new FakeBackend();
const limit = pLimit(CONCURRENCY);

const results = await Promise.all(
  scenarios.map((scenario) => limit(() => runScenario(scenario, appOverview, backend, { headed: false }))),
);

console.log(`\nmax concurrently active: ${maxActive} (limit was ${CONCURRENCY})`);
for (const result of results) {
  console.log(`${result.scenarioSlug}: ${result.status}${result.notes ? ` — ${result.notes}` : ""}`);
}

// Every scenario is expected to ERROR at the same-origin guard (see header comment) — a
// port/userDataDir collision would instead show up as a crash/rejection surfacing as a
// different, unexpected notes message (e.g. mentioning "reachable", "bridge", or "EADDRINUSE").
const unexpectedFailure = results.find(
  (result) => !result.notes?.includes("Expected the shared page to be on"),
);
if (unexpectedFailure || maxActive > CONCURRENCY) {
  console.error("\nFAILED: unexpected failure or max active exceeded the concurrency limit.");
  process.exit(1);
}
console.log("\nOK: no port/userDataDir collisions, concurrency limit respected.");
