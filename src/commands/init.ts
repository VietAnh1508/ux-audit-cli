import type { Command } from "commander";

// Scaffolds .ux-audit/ (config.json, app.json, scenarios/, guidelines/), prompts for
// the app.json fields, writes credentials.local.json's .gitignore entry, and runs the
// backend preflight check (installed + logged-in Claude Code CLI).
// See docs/UX_AUDIT_CLI_PLAN.md Command surface, docs/IMPLEMENTATION_PLAN.md Phase 0.
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold .ux-audit/ in the current project")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 0");
    });
}
