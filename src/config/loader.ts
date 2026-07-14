import { readFile } from "node:fs/promises";
import type { ZodType } from "zod";
import { AppConfigSchema, AppOverviewSchema } from "./schema.js";
import { resolveAppOverviewPath, resolveConfigPath } from "./paths.js";
import type { AppConfig, AppOverview, Credentials, Guideline, ScenarioConfig } from "../types/index.js";

export class ConfigLoadError extends Error {}

const INIT_HINT = "Run `ux-audit init` first.";

function isEnoent(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

async function loadAndValidate<T>(filePath: string, schema: ZodType<T>): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    if (isEnoent(err)) {
      throw new ConfigLoadError(`Missing ${filePath}. ${INIT_HINT}`);
    }
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ConfigLoadError(`${filePath} is not valid JSON.`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("\n");
    throw new ConfigLoadError(`${filePath} failed validation:\n${issues}`);
  }
  return result.data;
}

export async function loadConfig(cwd?: string): Promise<AppConfig> {
  return loadAndValidate(resolveConfigPath(cwd), AppConfigSchema);
}

export async function loadAppOverview(cwd?: string): Promise<AppOverview> {
  return loadAndValidate(resolveAppOverviewPath(cwd), AppOverviewSchema);
}

export async function loadScenarios(_cwd?: string): Promise<ScenarioConfig[]> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function loadCredentials(_ref: string, _cwd?: string): Promise<Credentials> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function loadGuideline(_name: string, _cwd?: string): Promise<Guideline> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 3");
}
