import type { Command } from "commander";

// See docs/UX_AUDIT_CLI_PLAN.md Command surface, docs/IMPLEMENTATION_PLAN.md Phase 1.
export function registerScenarioCommand(program: Command): void {
  const scenario = program.command("scenario").description("Manage stored scenarios");

  scenario
    .command("add")
    .description("Add a new scenario from ./references/scenario-template.md")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
    });

  scenario
    .command("list")
    .description("List stored scenarios")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
    });

  scenario
    .command("remove <slug>")
    .description("Remove a stored scenario")
    .action(async (_slug: string) => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
    });
}
