import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { cancel, intro, multiselect, outro } from "@clack/prompts";
import pLimit from "p-limit";
import { resolveBackend } from "../backends/resolve.js";
import { ConfigLoadError, loadAppOverview, loadConfig, loadScenarios } from "../config/loader.js";
import { errorFindings, runScenario } from "../engine/run-scenario.js";
import { renderMarkdown } from "../report/render.js";
import { synthesizeReport } from "../report/synthesize.js";
import { exitOnCancel } from "../utils/prompts.js";
import { formatScenarioDetail } from "../utils/scenario-format.js";
import type { ScenarioConfig } from "../types/index.js";

interface RunCommandOptions {
  scenario?: string;
  guideline: string;
  headed?: boolean;
  concurrency?: string;
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
    .option("--concurrency <n>", "max scenarios to run in parallel (default: config.json's concurrency)")
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
        "Report output:\n" +
        "  --output <path>                        -> write the combined report here.\n" +
        "  no --output, single scenario, scenario has an `output` field -> write there.\n" +
        "  otherwise                              -> <outputDir>/UX_AUDIT.md.",
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

      console.log("Checking LLM backend...");
      const backend = await resolveBackend(config.llmBackend);
      if (!(await backend.isAvailable())) {
        console.error(`LLM backend "${backend.name}" is not available — not installed, or not logged in.`);
        process.exit(1);
      }

      const requestedConcurrency = options.concurrency ? Number(options.concurrency) : undefined;
      const limit = pLimit(
        requestedConcurrency !== undefined && requestedConcurrency > 0 ? requestedConcurrency : config.concurrency,
      );
      const allFindings = await Promise.all(
        selectedScenarios.map((scenario) =>
          limit(async () => {
            console.log(`Running scenario "${scenario.slug}" against ${scenario.scenarioUrl ?? appOverview.url}...`);
            try {
              return await runScenario(scenario, appOverview, backend, { headed: options.headed });
            } catch (error) {
              return errorFindings(
                scenario.slug,
                `Scenario "${scenario.slug}" threw unexpectedly: ${(error as Error).message}`,
              );
            }
          }),
        ),
      );

      let hasFailure = false;
      const findingsPaths: string[] = [];
      for (const [index, findings] of allFindings.entries()) {
        const scenario = selectedScenarios[index]!;
        const findingsPath = path.join(config.outputDir, `${scenario.slug}-findings.json`);
        await mkdir(path.dirname(findingsPath), { recursive: true });
        await writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, "utf-8");
        findingsPaths.push(findingsPath);

        console.log(`Findings written to ${findingsPath} (status: ${findings.status}).`);
        if (findings.status !== "OK") {
          hasFailure = true;
        }
      }

      const reportOutputPath =
        options.output ??
        (selectedScenarios.length === 1 ? selectedScenarios[0]!.output : undefined) ??
        path.join(config.outputDir, "UX_AUDIT.md");

      if (allFindings.every((findings) => findings.status !== "OK")) {
        console.error(
          `Every scenario failed or was blocked — skipping report synthesis (leaving ${reportOutputPath} untouched, ` +
            "so a report from a previous run there is now stale). See the findings JSON files above for details.",
        );
        process.exitCode = 1;
        return;
      }

      console.log("Synthesizing combined report...");
      try {
        const report = await synthesizeReport(backend, findingsPaths, appOverview);
        const mode = selectedScenarios.length === 1 ? "single" : "multi";
        const markdown = renderMarkdown(report, mode);

        await mkdir(path.dirname(reportOutputPath), { recursive: true });
        await writeFile(reportOutputPath, `${markdown}\n`, "utf-8");

        console.log(`Report written to ${reportOutputPath}.`);
      } catch (error) {
        console.error(`Report synthesis failed: ${(error as Error).message}`);
        hasFailure = true;
      }

      if (hasFailure) {
        process.exitCode = 1;
      }
    });
}
