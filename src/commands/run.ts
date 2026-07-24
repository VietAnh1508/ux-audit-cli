import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { cancel, intro, multiselect, outro } from "@clack/prompts";
import { ConfigLoadError, loadAppOverview, loadConfig, loadScenarios } from "../config/loader.js";
import { runScenario } from "../engine/run-scenario.js";
import { exitOnCancel } from "../utils/prompts.js";
import { formatScenarioDetail } from "../utils/scenario-format.js";
import type { ScenarioConfig } from "../types/index.js";

interface RunCommandOptions {
  scenario?: string;
  guideline: string;
  headed?: boolean;
  concurrency: string;
  output?: string;
}

// Resolves which scenarios to run:
//   --scenario a,b  -> split on comma, trim, validate every slug against `scenarios`.
//   no --scenario, exactly 1 scenario on disk -> run it, no prompt.
//   no --scenario, >1 scenarios on disk       -> @clack/prompts multiselect checkbox.
async function selectScenarios(
  scenarios: ScenarioConfig[],
  scenarioOption: string | undefined,
): Promise<ScenarioConfig[]> {
  const bySlug = new Map(scenarios.map((scenario) => [scenario.slug, scenario]));

  if (scenarioOption) {
    const requestedSlugs = scenarioOption
      .split(",")
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0);

    if (requestedSlugs.length === 0) {
      console.error("--scenario was passed but contained no scenario slugs.");
      process.exit(1);
    }

    const unknownSlugs = requestedSlugs.filter((slug) => !bySlug.has(slug));
    if (unknownSlugs.length > 0) {
      console.error(
        `Scenario slug(s) not found: ${unknownSlugs.join(", ")}. Run \`ux-audit scenario list\` to see available scenarios.`,
      );
      process.exit(1);
    }

    return requestedSlugs.map((slug) => bySlug.get(slug)!);
  }

  if (scenarios.length === 1) {
    return scenarios;
  }

  intro("ux-audit run");
  const selected = exitOnCancel(
    await multiselect({
      message: "Select scenarios to run",
      options: scenarios.map((scenario) => ({
        value: scenario.slug,
        label: scenario.slug,
        hint: formatScenarioDetail(scenario),
      })),
      required: false,
    }),
    "run cancelled.",
  );
  if (selected.length === 0) {
    cancel("No scenarios selected.");
    process.exit(1);
  }
  outro(`Running ${selected.length} scenario(s).`);

  return selected.map((slug) => bySlug.get(slug)!);
}

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
        "Scenario selection:\n" +
        "  --scenario a,b                        -> run exactly those scenario slugs (comma-separated).\n" +
        "  no --scenario, exactly one on disk     -> runs it immediately.\n" +
        "  no --scenario, more than one on disk    -> interactive checkbox picker.\n" +
        "  no --scenario, zero on disk            -> errors, run `ux-audit scenario add` first.\n" +
        "\n" +
        "Concurrency (--concurrency) and combined report synthesis aren't implemented yet " +
        "(Phase 2, in progress) — each selected scenario runs sequentially and writes its own findings file.",
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

      const selectedScenarios = await selectScenarios(scenarios, options.scenario);

      let hasFailure = false;
      for (const scenario of selectedScenarios) {
        console.log(`Running scenario "${scenario.slug}" against ${scenario.scenarioUrl ?? appOverview.url}...`);
        const findings = await runScenario(scenario, appOverview, config, { headed: options.headed });

        const outputPath =
          selectedScenarios.length === 1 && options.output
            ? options.output
            : path.join(config.outputDir, `${scenario.slug}-findings.json`);
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, `${JSON.stringify(findings, null, 2)}\n`, "utf-8");

        console.log(`Findings written to ${outputPath} (status: ${findings.status}).`);
        if (findings.status !== "OK") {
          hasFailure = true;
        }
      }

      if (hasFailure) {
        process.exitCode = 1;
      }
    });
}
