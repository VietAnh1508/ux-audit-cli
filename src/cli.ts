#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerAppCommand } from "./commands/app.js";
import { registerScenarioCommand } from "./commands/scenario.js";
import { registerGuidelineCommand } from "./commands/guideline.js";
import { registerRunCommand } from "./commands/run.js";

const program = new Command();

program.name("ux-audit").description("Automated UX audit CLI").version("0.0.0");

registerInitCommand(program);
registerAppCommand(program);
registerScenarioCommand(program);
registerGuidelineCommand(program);
registerRunCommand(program);

program.parseAsync(process.argv);
