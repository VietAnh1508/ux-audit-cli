import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ZodError, ZodType } from "zod";
import { AppConfigSchema, AppOverviewSchema, ScenarioConfigSchema } from "./schema.js";
import { resolveAppOverviewPath, resolveConfigPath, resolveScenariosDir } from "./paths.js";
import type { AppConfig, AppOverview, Credentials, Guideline, ScenarioConfig } from "../types/index.js";

export class ConfigLoadError extends Error {}

const INIT_HINT = "Run `ux-audit init` first.";

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

export function formatZodIssues(error: ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".") || "<root>"}: ${issue.message}`).join("\n");
}

async function readOrThrowInitHint<T>(read: () => Promise<T>, targetPath: string): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isEnoent(error)) {
      throw new ConfigLoadError(`Missing ${targetPath}. ${INIT_HINT}`);
    }
    throw error;
  }
}

async function loadAndValidate<T>(filePath: string, schema: ZodType<T>): Promise<T> {
  const rawData = await readOrThrowInitHint(() => readFile(filePath, "utf-8"), filePath);

  let data: unknown;
  try {
    data = JSON.parse(rawData);
  } catch {
    throw new ConfigLoadError(`${filePath} is not valid JSON.`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ConfigLoadError(`${filePath} failed validation:\n${formatZodIssues(result.error)}`);
  }
  return result.data;
}

// Scenario files are markdown with a "frontmatter-ish" block of `**Field:** value` lines
// followed by a `## Scenario` section of free-text steps — see
// reference/ux-audit-skill/references/scenario-template.md for the field set this mirrors.
const SCENARIO_FIELD_PATTERN = /^\*\*([^*:]+):\*\*\s*(.*)$/;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const SCENARIO_HEADING_PATTERN = /^##\s+Scenario\b.*$/m;

// Maps the human-readable markdown field name to its ScenarioConfigSchema key. `Auth` maps to
// `credentialsRef` — a lookup key into credentials.local.json, not an inline email/password.
const SCENARIO_FIELD_MAP: Record<string, string> = {
  "app url": "appUrl",
  "app name": "appName",
  "app persona": "appPersona",
  auth: "credentialsRef",
  session: "session",
  viewport: "viewport",
  output: "output",
};

function parseScenarioFields(header: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of header.split("\n")) {
    const match = line.match(SCENARIO_FIELD_PATTERN);
    if (!match) continue;
    fields.set((match[1] ?? "").trim().toLowerCase(), (match[2] ?? "").trim());
  }
  return fields;
}

function buildScenarioInput(filePath: string, fileName: string, content: string): unknown {
  const withoutComments = content.replace(HTML_COMMENT_PATTERN, "");
  const headingMatch = withoutComments.match(SCENARIO_HEADING_PATTERN);
  if (!headingMatch || headingMatch.index === undefined) {
    throw new ConfigLoadError(`${filePath} is missing a \`## Scenario\` section with free-text steps.`);
  }
  const header = withoutComments.slice(0, headingMatch.index);
  const steps = withoutComments.slice(headingMatch.index + headingMatch[0].length).trim();
  if (!steps) {
    throw new ConfigLoadError(`${filePath} has a \`## Scenario\` section with no steps.`);
  }

  const input: Record<string, unknown> = {
    slug: fileName.replace(/\.md$/i, ""),
    steps,
  };

  const fields = parseScenarioFields(header);
  for (const [fieldName, schemaKey] of Object.entries(SCENARIO_FIELD_MAP)) {
    const value = fields.get(fieldName);
    if (!value) continue;
    input[schemaKey] = value;
  }

  return input;
}

export async function loadConfig(cwd?: string): Promise<AppConfig> {
  return loadAndValidate(resolveConfigPath(cwd), AppConfigSchema);
}

export async function loadAppOverview(cwd?: string): Promise<AppOverview> {
  return loadAndValidate(resolveAppOverviewPath(cwd), AppOverviewSchema);
}

export async function loadScenarios(cwd?: string): Promise<ScenarioConfig[]> {
  const scenariosDir = resolveScenariosDir(cwd);
  const entries = await readOrThrowInitHint(() => readdir(scenariosDir), scenariosDir);
  const fileNames = entries.filter((name) => name.toLowerCase().endsWith(".md")).sort();

  const scenarios: ScenarioConfig[] = [];
  for (const fileName of fileNames) {
    const filePath = path.join(scenariosDir, fileName);
    const content = await readFile(filePath, "utf-8");
    const input = buildScenarioInput(filePath, fileName, content);

    const result = ScenarioConfigSchema.safeParse(input);
    if (!result.success) {
      throw new ConfigLoadError(`${filePath} failed validation:\n${formatZodIssues(result.error)}`);
    }
    scenarios.push(result.data);
  }

  return scenarios;
}

export async function loadCredentials(_ref: string, _cwd?: string): Promise<Credentials> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function loadGuideline(_name: string, _cwd?: string): Promise<Guideline> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 3");
}
