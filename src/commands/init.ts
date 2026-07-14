import { mkdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { cancel, confirm, intro, isCancel, note, outro, text } from "@clack/prompts";
import { AppConfigSchema, AppOverviewSchema, GuidelineSchema } from "../config/schema.js";
import {
  resolveAppOverviewPath,
  resolveConfigPath,
  resolveCredentialsPath,
  resolveGuidelinesDir,
  resolveScenariosDir,
} from "../config/paths.js";
import type { AppOverview } from "../types/index.js";

const APP_OVERVIEW_FIELDS: Array<{ key: keyof AppOverview; message: string }> = [
  { key: "name", message: "App name" },
  { key: "description", message: "One-paragraph description of what the app does" },
  { key: "coreBusiness", message: "Core business model (e.g. subscription, ad-supported, marketplace)" },
  { key: "targetUsers", message: "Target user segments (who this app is for)" },
];

function exitOnCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("init cancelled.");
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

async function ensureGitignoreEntry(cwd: string): Promise<void> {
  const entry = path.relative(cwd, resolveCredentialsPath(cwd)).split(path.sep).join("/");
  const gitignorePath = path.join(cwd, ".gitignore");

  let contents = "";
  try {
    contents = await readFile(gitignorePath, "utf-8");
  } catch {
    contents = "";
  }

  if (contents.split("\n").some((line) => line.trim() === entry)) {
    return;
  }

  const needsLeadingNewline = contents.length > 0 && !contents.endsWith("\n");
  await writeFile(gitignorePath, `${contents}${needsLeadingNewline ? "\n" : ""}${entry}\n`, "utf-8");
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold .ux-audit/ in the current project")
    .action(async () => {
      const cwd = process.cwd();
      const configPath = resolveConfigPath(cwd);

      intro("ux-audit init");

      const alreadyInitialized = await fileExists(configPath);
      if (alreadyInitialized) {
        const overwrite = exitOnCancel(
          await confirm({
            message: ".ux-audit/ is already set up here. Reset app.json and config.json?",
            initialValue: false,
          }),
        );
        if (!overwrite) {
          outro("Nothing changed. Use `ux-audit app edit` to update the app overview.");
          return;
        }
      }

      note(
        alreadyInitialized
          ? "Let's re-enter your app overview."
          : "No app overview found yet — let's set one up. A few questions about the app being audited, so ux-audit can tailor its findings to it.",
        "App overview",
      );

      const answers: Partial<Record<keyof AppOverview, string>> = {};
      for (const field of APP_OVERVIEW_FIELDS) {
        const value = exitOnCancel(
          await text({
            message: field.message,
            validate: (input) => (input?.trim() ? undefined : "Required"),
          }),
        );
        answers[field.key] = value.trim();
      }

      const appOverview = AppOverviewSchema.parse(answers);
      const appConfig = AppConfigSchema.parse({});

      await mkdir(resolveScenariosDir(cwd), { recursive: true });
      await mkdir(resolveGuidelinesDir(cwd), { recursive: true });

      await writeFile(resolveAppOverviewPath(cwd), `${JSON.stringify(appOverview, null, 2)}\n`, "utf-8");
      await writeFile(configPath, `${JSON.stringify(appConfig, null, 2)}\n`, "utf-8");

      const w3cGuidelinePath = path.join(resolveGuidelinesDir(cwd), "w3c.json");
      if (!(await fileExists(w3cGuidelinePath))) {
        const w3cGuideline = GuidelineSchema.parse({ name: "w3c", axeTags: ["wcag22aa"] });
        await writeFile(w3cGuidelinePath, `${JSON.stringify(w3cGuideline, null, 2)}\n`, "utf-8");
      }

      await ensureGitignoreEntry(cwd);

      outro(
        "App overview saved in .ux-audit/app.json. Next: run `ux-audit scenario add` to add your testing scenario.",
      );
    });
}
