import type { Command } from "commander";

// Built-ins: w3c (default, wcag22aa), us-section508, eu-en301549 — all axe tag-set
// variants of the same rule engine. See docs/UX_AUDIT_CLI_PLAN.md Decision 3.
export function registerGuidelineCommand(program: Command): void {
  const guideline = program.command("guideline").description("Manage accessibility guidelines");

  guideline
    .command("list")
    .description("List built-in and custom guidelines")
    .action(async () => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 3");
    });

  guideline
    .command("add <name>")
    .description("Add a custom guideline (axe tags + checklist)")
    .action(async (_name: string) => {
      throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 3");
    });
}
