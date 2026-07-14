import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAppOverviewPath, resolveConfigPath, resolveUxAuditDir } from "./paths.js";
import { ConfigLoadError, loadAppOverview, loadConfig } from "./loader.js";

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
      description: "Sells widgets online.",
      coreBusiness: "E-commerce",
      targetUsers: "Small business owners",
    };
    await writeUxAuditFile(cwd, resolveAppOverviewPath(cwd), JSON.stringify(overview));

    await expect(loadAppOverview(cwd)).resolves.toEqual(overview);
  });
});
