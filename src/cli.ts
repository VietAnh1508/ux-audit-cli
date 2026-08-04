#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerAppCommand } from "./commands/app.js";
import { registerScenarioCommand } from "./commands/scenario.js";
import { registerGuidelineCommand } from "./commands/guideline.js";
import { registerRunCommand } from "./commands/run.js";

// Read at runtime rather than importing the JSON module so this keeps working from both
// `tsx src/cli.ts` (package.json one level up from src/) and the built `dist/cli.js`
// (package.json one level up from dist/) without a tsconfig change.
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

const program = new Command();

program.name("ux-audit").description("Automated UX audit CLI").version(packageJson.version);

registerInitCommand(program);
registerAppCommand(program);
registerScenarioCommand(program);
registerGuidelineCommand(program);
registerRunCommand(program);

program.parseAsync(process.argv);
