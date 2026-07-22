import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { ConfigLoadError, loadAppOverview, loadConfig, loadScenarios } from "../config/loader.js";
import { runScenario } from "../engine/run-scenario.js";

interface RunCommandOptions {
  guideline: string;
  headed?: boolean;
  concurrency: string;
  output?: string;
}

// No --scenario -> interactive checkbox picker over discovered scenarios (@clack/prompts).
// See docs/UX_AUDIT_CLI_PLAN.md Command surface + Execution engine, docs/IMPLEMENTATION_PLAN.md
// Phase 1 (single scenario) and Phase 2 (multi-scenario + picker + concurrency).
export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run one or more UX audit scenarios")
    .option("--scenario <slugs>", "comma-separated scenario slugs to run")
    .option("--guideline <name>", "accessibility guideline to apply", "w3c")
    .option("--headed", "run the browser headed instead of headless (default: headless)")
    .option("--concurrency <n>", "max scenarios to run in parallel", "2")
    .option("--output <path>", "report output path")
    .addHelpText(
      "after",
      "\n" +
        "Scenario selection (Phase 1 — no --scenario parsing or picker yet):\n" +
        "  Exactly one scenario in .ux-audit/scenarios/ -> runs it immediately, no flags needed.\n" +
        "  Zero scenarios                                -> errors, run `ux-audit scenario add` first.\n" +
        "  More than one scenario                        -> errors; multi-scenario selection is Phase 2.",
    )
    .action(async (options: RunCommandOptions) => {
      const cwd = process.cwd();

      let config, appOverview, scenarios;
      try {
        config = await loadConfig(cwd);
        appOverview = await loadAppOverview(cwd);
        scenarios = await loadScenarios(cwd);
      } catch (error) {
        if (error instanceof ConfigLoadError) {
          console.error(error.message);
          process.exit(1);
        }
        throw error;
      }

      if (scenarios.length === 0) {
        console.error("No scenarios found. Run `ux-audit scenario add` first.");
        process.exit(1);
      }
      if (scenarios.length > 1) {
        console.error(
          "Multiple scenarios found, but --scenario selection and the multi-scenario picker aren't " +
            "implemented yet (Phase 2). Keep only one file in .ux-audit/scenarios/ for now.",
        );
        process.exit(1);
      }
      const [scenario] = scenarios;
      if (!scenario) {
        // Unreachable — guarded by the length checks above, narrows the type for TS.
        return;
      }

      console.log(`Running scenario "${scenario.slug}" against ${scenario.scenarioUrl ?? appOverview.url}...`);
      const findings = await runScenario(scenario, appOverview, config, { headed: options.headed });

      const outputPath = options.output ?? path.join(config.outputDir, `${scenario.slug}-findings.json`);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(findings, null, 2)}\n`, "utf-8");

      console.log(`Findings written to ${outputPath} (status: ${findings.status}).`);
      if (findings.status !== "OK") {
        process.exitCode = 1;
      }
    });
}
