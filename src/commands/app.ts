import { writeFile } from "node:fs/promises";
import type { Command } from "commander";
import { cancel, intro, isCancel, outro, text } from "@clack/prompts";
import { AppOverviewSchema } from "../config/schema.js";
import { resolveAppOverviewPath } from "../config/paths.js";
import { loadAppOverview, ConfigLoadError } from "../config/loader.js";
import type { AppOverview } from "../types/index.js";
import { APP_OVERVIEW_FIELDS } from "./app-overview-fields.js";

function exitOnCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("app edit cancelled.");
    process.exit(1);
  }
  return value;
}

// Updates the stored app overview (name, URL, description, core business, target users)
// without re-running the full `init` flow. See docs/UX_AUDIT_CLI_PLAN.md Decision 6.
export function registerAppCommand(program: Command): void {
  const app = program.command("app").description("Manage the stored app overview");

  app
    .command("edit")
    .description("Update app.json (name, URL, description, core business, target users)")
    .action(async () => {
      const cwd = process.cwd();

      let current: AppOverview;
      try {
        current = await loadAppOverview(cwd);
      } catch (err) {
        if (err instanceof ConfigLoadError) {
          console.error(err.message);
          process.exit(1);
        }
        throw err;
      }

      intro("ux-audit app edit");

      const answers: Partial<Record<keyof AppOverview, string>> = {};
      for (const field of APP_OVERVIEW_FIELDS) {
        const value = exitOnCancel(
          await text({
            message: field.message,
            initialValue: current[field.key],
            validate: (input) => field.validate(input ?? ""),
          }),
        );
        answers[field.key] = value.trim();
      }

      const appOverview = AppOverviewSchema.parse(answers);
      await writeFile(resolveAppOverviewPath(cwd), `${JSON.stringify(appOverview, null, 2)}\n`, "utf-8");

      outro("App overview updated in .ux-audit/app.json.");
    });
}
