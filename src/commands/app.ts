import type { Command } from "commander";

// Updates the stored app overview (name, description, core business, target users)
// without re-running the full `init` flow. See docs/UX_AUDIT_CLI_PLAN.md Decision 6.
export function registerAppCommand(program: Command): void {
  const app = program.command("app").description("Manage the stored app overview");

  app
    .command("edit")
    .description("Update app.json (name, description, core business, target users)")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 0");
    });
}
