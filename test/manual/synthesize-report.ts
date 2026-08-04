// Manual smoke test for report/synthesize.ts + ClaudeCodeBackend.synthesizeReport — spawns a
// real `claude -p` subprocess, so it's not run by `pnpm test` (see
// docs/phases/phase-2-multi-scenario/overview.md Testing strategy for why this class of check
// is manual, not mocked).
//
// Run with: ./node_modules/.bin/tsx test/manual/synthesize-report.ts
//
// Fixtures are test/fixtures/scenario-findings/*.json — three scenarios (two OK, sharing one
// cross-scenario CTA-contrast issue worded differently in each so dedup has to do real work;
// one BLOCKED with no findings, to exercise a non-OK section passing through untouched).
// Expect: crossScenarioFindings has exactly one entry with appearsIn: ["login", "checkout"],
// sections carries all three scenarios verbatim (including the BLOCKED one's notes), and the
// result passes ReportSchema.parse() inside synthesizeReport without throwing.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClaudeCodeBackend } from "../../src/backends/claude-code.js";
import { synthesizeReport } from "../../src/report/synthesize.js";
import type { AppOverview } from "../../src/types/index.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/scenario-findings");

const appOverview: AppOverview = {
  name: "ShopFast",
  url: "https://example.com",
  description: "An e-commerce storefront for buying sneakers.",
  coreBusiness: "Online retail of limited-edition sneakers.",
  targetUsers: "Sneaker enthusiasts aged 18-35, mostly mobile.",
};

const fileNames = (await readdir(fixturesDir)).filter((name) => name.endsWith("-findings.json"));
const findingsPaths = fileNames.map((name) => path.join(fixturesDir, name));

const report = await synthesizeReport(new ClaudeCodeBackend(), findingsPaths, appOverview);
console.log(JSON.stringify(report, null, 2));
