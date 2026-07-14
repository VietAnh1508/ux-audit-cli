import type { Command } from "commander";

// No --scenario -> interactive checkbox picker over discovered scenarios (@clack/prompts).
// See docs/UX_AUDIT_CLI_PLAN.md Command surface + Execution engine, docs/IMPLEMENTATION_PLAN.md
// Phase 1 (single scenario) and Phase 2 (multi-scenario + picker + concurrency).
export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run one or more UX audit scenarios")
    .option("--scenario <slugs>", "comma-separated scenario slugs to run")
    .option("--guideline <name>", "accessibility guideline to apply", "w3c")
    .option("--headed", "run the browser headed instead of headless")
    .option("--concurrency <n>", "max scenarios to run in parallel", "2")
    .option("--output <path>", "report output path")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
    });
}
