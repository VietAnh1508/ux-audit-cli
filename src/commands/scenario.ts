import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { cancel, confirm, intro, isCancel, multiselect, outro, text } from "@clack/prompts";
import { resolveScenariosDir } from "../config/paths.js";
import { loadConfig, loadScenarios, ConfigLoadError } from "../config/loader.js";
import type { ScenarioConfig } from "../types/index.js";

function exitOnCancel<T>(value: T | symbol, message = "Cancelled."): T {
  if (isCancel(value)) {
    cancel(message);
    process.exit(1);
  }
  return value;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function listScenarioSlugs(scenariosDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(scenariosDir);
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  return entries
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .map((name) => name.replace(/\.md$/i, ""))
    .sort();
}

function formatScenarioSummary(scenario: ScenarioConfig): string {
  const details = [`viewport: ${scenario.viewport}`, `session: ${scenario.session}`];
  if (scenario.credentialsRef) details.push(`auth: ${scenario.credentialsRef}`);
  if (scenario.scenarioUrl) details.push(`url: ${scenario.scenarioUrl}`);
  if (scenario.output) details.push(`output: ${scenario.output}`);
  return `${scenario.slug}\n  ${details.join("  ")}`;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Same field set as reference/ux-audit-skill/references/scenario-template.md, except
// `Auth` takes a credentialsRef (a key into credentials.local.json) instead of an
// inline email/password, there's no App Name/Persona field (that context comes from
// app.json), and App URL is now Scenario URL — optional, only needed when a scenario
// targets a different page than app.json's URL (see src/config/loader.ts's
// SCENARIO_FIELD_MAP).
function buildScenarioTemplate(name: string): string {
  return `# ${name}

<!-- Short name for this journey, e.g. "New User Onboarding" or "Core Voting Loop" -->

<!-- Scenario URL: only needed when this scenario should start on a different page
     than app.json's URL, e.g. a deep link to a specific settings page. Omit to start
     at the app's URL.
**Scenario URL:** http://localhost:3000/settings
-->

**Auth:** test-user

<!-- Auth: a key into .ux-audit/credentials.local.json, e.g. "test-user" ->
     { "email": "...", "password": "..." }. Use a dedicated test account created
     solely for this audit — never a personal or production account.
     Omit this field entirely for public pages (landing pages, product listings, etc.)
     that do not require sign-in. -->

**Session:** fresh

<!-- Session options (only relevant when Auth is present):
     fresh         — log out any existing session before starting; use when the scenario tests sign-in or onboarding
     authenticated — sign in silently if not already logged in, then navigate to the app's URL; use when the scenario starts mid-app
     Omit alongside Auth when the scenario is entirely public-facing.
-->

**Viewport:** desktop

<!-- Viewport options: desktop (default) | mobile (390px width) -->

**Output:** UX_AUDIT.md

<!-- Output path for the report. Defaults to UX_AUDIT.md in the project root if omitted. -->

## Scenario

You are a first-time user who just received an invite link. You have never
seen this app before.

1. Arrive at the sign-in page. Try to understand what the app is before logging in.
2. Submit the form with a wrong password to see how errors are handled.
3. Sign in successfully and take stock of the landing screen.
4. Find the core action (e.g. "cast a vote") and complete it.
5. Observe the confirmation state — does the app make it clear what just happened?
`;
}

export function registerScenarioCommand(program: Command): void {
  const scenario = program.command("scenario").description("Manage stored scenarios");

  scenario
    .command("add [name]")
    .description("Add a new scenario from the scenario template")
    .action(async (nameArg?: string) => {
      const cwd = process.cwd();

      try {
        await loadConfig(cwd);
      } catch (err) {
        if (err instanceof ConfigLoadError) {
          console.error(err.message);
          process.exit(1);
        }
        throw err;
      }

      intro("ux-audit scenario add");

      let name: string;
      if (nameArg) {
        if (!slugify(nameArg)) {
          cancel(`"${nameArg}" doesn't contain any usable characters for a scenario name.`);
          process.exit(1);
        }
        name = nameArg;
      } else {
        name = exitOnCancel(
          await text({
            message: 'Scenario name (e.g. "New User Onboarding")',
            validate: (input) => (slugify(input ?? "") ? undefined : "Required"),
          }),
          "scenario add cancelled.",
        );
      }

      const slug = slugify(name);
      const scenariosDir = resolveScenariosDir(cwd);
      const filePath = path.join(scenariosDir, `${slug}.md`);

      if (await fileExists(filePath)) {
        const overwrite = exitOnCancel(
          await confirm({
            message: `.ux-audit/scenarios/${slug}.md already exists. Overwrite?`,
            initialValue: false,
          }),
          "scenario add cancelled.",
        );
        if (!overwrite) {
          outro("Nothing changed.");
          return;
        }
      }

      await mkdir(scenariosDir, { recursive: true });
      await writeFile(filePath, buildScenarioTemplate(name), "utf-8");

      outro(`Scenario scaffolded at .ux-audit/scenarios/${slug}.md — edit it, then run \`ux-audit run\`.`);
    });

  scenario
    .command("list")
    .description("List stored scenarios")
    .action(async () => {
      const cwd = process.cwd();

      let scenarios: ScenarioConfig[];
      try {
        scenarios = await loadScenarios(cwd);
      } catch (err) {
        if (err instanceof ConfigLoadError) {
          console.error(err.message);
          process.exit(1);
        }
        throw err;
      }

      if (scenarios.length === 0) {
        console.log("No scenarios found. Run `ux-audit scenario add` to create one.");
        return;
      }

      console.log(scenarios.map(formatScenarioSummary).join("\n\n"));
    });

  scenario
    .command("remove [slug]")
    .description("Remove a stored scenario")
    .action(async (slugArg?: string) => {
      const cwd = process.cwd();
      const scenariosDir = resolveScenariosDir(cwd);
      const slugs = await listScenarioSlugs(scenariosDir);

      if (slugs.length === 0) {
        console.log("No scenarios found.");
        return;
      }

      intro("ux-audit scenario remove");

      let slugsToRemove: string[];
      if (slugArg) {
        if (!slugs.includes(slugArg)) {
          cancel(`No scenario found matching "${slugArg}".`);
          process.exit(1);
        }
        slugsToRemove = [slugArg];
      } else {
        const selected = exitOnCancel(
          await multiselect({
            message: "Select scenarios to remove",
            options: slugs.map((slug) => ({ value: slug, label: slug })),
            required: false,
          }),
          "scenario remove cancelled.",
        );
        if (selected.length === 0) {
          outro("Nothing selected.");
          return;
        }
        slugsToRemove = selected;
      }

      const confirmMessage =
        slugsToRemove.length === 1
          ? `Remove .ux-audit/scenarios/${slugsToRemove[0]}.md?`
          : `Remove ${slugsToRemove.length} scenarios: ${slugsToRemove.join(", ")}?`;
      const confirmed = exitOnCancel(
        await confirm({ message: confirmMessage, initialValue: false }),
        "scenario remove cancelled.",
      );
      if (!confirmed) {
        outro("Nothing changed.");
        return;
      }

      for (const slug of slugsToRemove) {
        await unlink(path.join(scenariosDir, `${slug}.md`));
      }

      outro(
        slugsToRemove.length === 1
          ? `Removed .ux-audit/scenarios/${slugsToRemove[0]}.md`
          : `Removed ${slugsToRemove.length} scenarios.`,
      );
    });
}
