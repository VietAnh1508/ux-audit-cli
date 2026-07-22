import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAppOverviewPath, resolveConfigPath, resolveScenariosDir, resolveUxAuditDir } from "./paths.js";
import { ConfigLoadError, loadAppOverview, loadConfig, loadScenarios } from "./loader.js";

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "ux-audit-loader-test-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

async function writeUxAuditFile(cwd: string, filePath: string, contents: string): Promise<void> {
  await mkdir(resolveUxAuditDir(cwd), { recursive: true });
  await writeFile(filePath, contents, "utf-8");
}

describe("loadConfig", () => {
  it("throws a friendly error, not a raw ENOENT, when .ux-audit/ is missing", async () => {
    await expect(loadConfig(cwd)).rejects.toThrow(/ux-audit init/);
  });

  it("throws a friendly error, not a raw JSON parse error, when config.json is not valid JSON", async () => {
    await writeUxAuditFile(cwd, resolveConfigPath(cwd), "{ not json");

    await expect(loadConfig(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadConfig(cwd)).rejects.toThrow(/not valid JSON/);
  });

  it("throws a friendly error, not a raw zod error, when config.json fails schema validation", async () => {
    await writeUxAuditFile(cwd, resolveConfigPath(cwd), JSON.stringify({ concurrency: "two" }));

    await expect(loadConfig(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadConfig(cwd)).rejects.toThrow(/failed validation/);
    await expect(loadConfig(cwd)).rejects.toThrow(/concurrency/);
  });

  it("applies schema defaults and returns a valid config", async () => {
    await writeUxAuditFile(cwd, resolveConfigPath(cwd), JSON.stringify({}));

    await expect(loadConfig(cwd)).resolves.toEqual({
      defaultGuideline: "w3c",
      concurrency: 2,
      outputDir: ".",
      llmBackend: "auto",
    });
  });

  it("returns explicitly set values as-is", async () => {
    await writeUxAuditFile(
      cwd,
      resolveConfigPath(cwd),
      JSON.stringify({
        defaultGuideline: "us-section508",
        concurrency: 4,
        outputDir: "reports",
        llmBackend: "codex",
      }),
    );

    await expect(loadConfig(cwd)).resolves.toEqual({
      defaultGuideline: "us-section508",
      concurrency: 4,
      outputDir: "reports",
      llmBackend: "codex",
    });
  });
});

describe("loadAppOverview", () => {
  it("throws a friendly error, not a raw ENOENT, when .ux-audit/ is missing", async () => {
    await expect(loadAppOverview(cwd)).rejects.toThrow(/ux-audit init/);
  });

  it("throws a friendly error, not a raw zod error, when app.json is missing required fields", async () => {
    await writeUxAuditFile(cwd, resolveAppOverviewPath(cwd), JSON.stringify({ name: "Acme" }));

    await expect(loadAppOverview(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadAppOverview(cwd)).rejects.toThrow(/failed validation/);
    await expect(loadAppOverview(cwd)).rejects.toThrow(/description/);
  });

  it("returns a valid app overview", async () => {
    const overview = {
      name: "Acme",
      url: "https://acme.example.com",
      description: "Sells widgets online.",
      coreBusiness: "E-commerce",
      targetUsers: "Small business owners",
    };
    await writeUxAuditFile(cwd, resolveAppOverviewPath(cwd), JSON.stringify(overview));

    await expect(loadAppOverview(cwd)).resolves.toEqual(overview);
  });

  it("throws a friendly error, not a raw zod error, when app.json's url is not a valid URL", async () => {
    await writeUxAuditFile(
      cwd,
      resolveAppOverviewPath(cwd),
      JSON.stringify({
        name: "Acme",
        url: "not-a-url",
        description: "Sells widgets online.",
        coreBusiness: "E-commerce",
        targetUsers: "Small business owners",
      }),
    );

    await expect(loadAppOverview(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadAppOverview(cwd)).rejects.toThrow(/failed validation/);
    await expect(loadAppOverview(cwd)).rejects.toThrow(/url/);
  });
});

async function writeScenarioFile(cwd: string, fileName: string, contents: string): Promise<void> {
  await mkdir(resolveScenariosDir(cwd), { recursive: true });
  await writeFile(path.join(resolveScenariosDir(cwd), fileName), contents, "utf-8");
}

const FULL_SCENARIO = `# Core Voting Loop

<!-- Short name for this journey -->

**Scenario URL:** http://localhost:3000/vote
**Auth:** default

<!-- Auth: use a dedicated test account created solely for this audit.
     Omit this field entirely for public pages that do not require sign-in. -->

**Session:** fresh

<!-- Session options: fresh | authenticated -->

**Viewport:** desktop

<!-- Viewport options: desktop (default) | mobile (390px width) -->

**Output:** .claude/ux-audit/voting-audit.md

<!-- Output path for the report. -->

## Scenario

You are a first-time user who just received an invite link.

1. Arrive at the sign-in page.
2. Sign in successfully and take stock of the landing screen.
`;

const MINIMAL_PUBLIC_SCENARIO = `# Landing Page Review

## Scenario

1. Read the landing page as a skeptical first-time visitor.
2. Note whether the value proposition is clear within a few seconds.
`;

describe("loadScenarios", () => {
  it("throws a friendly error, not a raw ENOENT, when .ux-audit/scenarios/ is missing", async () => {
    await expect(loadScenarios(cwd)).rejects.toThrow(/ux-audit init/);
  });

  it("returns an empty array when the scenarios directory is empty", async () => {
    await mkdir(resolveScenariosDir(cwd), { recursive: true });

    await expect(loadScenarios(cwd)).resolves.toEqual([]);
  });

  it("ignores non-markdown files in the scenarios directory", async () => {
    await writeScenarioFile(cwd, "core-voting-loop.md", FULL_SCENARIO);
    await writeScenarioFile(cwd, ".DS_Store", "not a scenario");
    await writeScenarioFile(cwd, "README.txt", "not a scenario");

    const scenarios = await loadScenarios(cwd);

    expect(scenarios).toHaveLength(1);
  });

  it("parses every field, derives the slug from the filename, and strips comments from the steps", async () => {
    await writeScenarioFile(cwd, "core-voting-loop.md", FULL_SCENARIO);

    const scenarios = await loadScenarios(cwd);

    expect(scenarios).toEqual([
      {
        slug: "core-voting-loop",
        scenarioUrl: "http://localhost:3000/vote",
        credentialsRef: "default",
        session: "fresh",
        viewport: "desktop",
        output: ".claude/ux-audit/voting-audit.md",
        steps: [
          "You are a first-time user who just received an invite link.",
          "",
          "1. Arrive at the sign-in page.",
          "2. Sign in successfully and take stock of the landing screen.",
        ].join("\n"),
      },
    ]);
  });

  it("applies schema defaults and leaves Auth/Output/Scenario URL unset for a public scenario with none of those fields", async () => {
    await writeScenarioFile(cwd, "landing-page-review.md", MINIMAL_PUBLIC_SCENARIO);

    const scenarios = await loadScenarios(cwd);

    expect(scenarios).toEqual([
      {
        slug: "landing-page-review",
        session: "fresh",
        viewport: "desktop",
        steps: [
          "1. Read the landing page as a skeptical first-time visitor.",
          "2. Note whether the value proposition is clear within a few seconds.",
        ].join("\n"),
      },
    ]);
  });

  it("throws a friendly error, not a raw zod error, when Scenario URL is not a valid URL", async () => {
    const invalidScenarioUrl = `${MINIMAL_PUBLIC_SCENARIO.replace(
      "## Scenario",
      "**Scenario URL:** not-a-url\n\n## Scenario",
    )}`;
    await writeScenarioFile(cwd, "broken.md", invalidScenarioUrl);

    await expect(loadScenarios(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadScenarios(cwd)).rejects.toThrow(/failed validation/);
    await expect(loadScenarios(cwd)).rejects.toThrow(/scenarioUrl/);
  });

  it("throws a friendly error when the file has no `## Scenario` section", async () => {
    const missingSteps = MINIMAL_PUBLIC_SCENARIO.replace(/## Scenario[\s\S]*/, "");
    await writeScenarioFile(cwd, "no-steps.md", missingSteps);

    await expect(loadScenarios(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadScenarios(cwd)).rejects.toThrow(/## Scenario/);
  });

  it("throws a friendly error when the `## Scenario` section has a heading but no steps", async () => {
    const emptySteps = `${MINIMAL_PUBLIC_SCENARIO.replace(/## Scenario[\s\S]*/, "")}## Scenario\n\n`;
    await writeScenarioFile(cwd, "empty-steps.md", emptySteps);

    await expect(loadScenarios(cwd)).rejects.toBeInstanceOf(ConfigLoadError);
    await expect(loadScenarios(cwd)).rejects.toThrow(/no steps/);
  });

  it("returns scenarios sorted by filename", async () => {
    await writeScenarioFile(cwd, "b-scenario.md", MINIMAL_PUBLIC_SCENARIO);
    await writeScenarioFile(cwd, "a-scenario.md", MINIMAL_PUBLIC_SCENARIO);

    const scenarios = await loadScenarios(cwd);

    expect(scenarios.map((s) => s.slug)).toEqual(["a-scenario", "b-scenario"]);
  });
});
