---
description: Update docs/phases/ task/overview/plan docs to reflect work just done, following docs/phases/CONVENTIONS.md
---

Read [`docs/phases/CONVENTIONS.md`](../../docs/phases/CONVENTIONS.md) in full before doing
anything else — it is the source of truth for section purposes, the N/A rule, status
ownership, filenames, and cross-referencing. This command does not restate those rules;
follow the doc, not your memory of a previous run.

## What to do

Arguments (`$ARGUMENTS`): optionally a task file path, a phase slug, or a description
of what was just built. If empty, infer scope from the current session's work and/or
`git diff`/`git log` since the last commit.

1. **Identify which task(s) this covers.** Match the changed files/behavior to an
   existing `docs/phases/phase-N-<slug>/NN-<task-name>.md`, or to a Plan bullet in a
   phase's `overview.md` that has no task file yet. If it doesn't clearly map to either
   — new work not covered by any phase's Plan — ask the user which phase it belongs to
   before creating anything.

2. **If the task file doesn't exist yet, create it** using the template in
   CONVENTIONS.md. Source its Plan section per CONVENTIONS.md's "Sourcing Plan" rule —
   from the phase overview's existing bullet, or other original planning text. If
   neither exists, ask the user what was originally intended. Never write Plan by
   describing what the code ends up doing.

3. **If the task file already exists, update Implementation log / Testing evidence /
   Gotchas** to reflect what was actually done — don't touch Plan (it's the pre-existing
   scope, not a running log).

4. **Update Status** on the task file first. Then update the phase `overview.md`
   checklist to match. Then update `docs/IMPLEMENTATION_PLAN.md`'s "Active phase" line
   and Phases table if the phase's overall status changed. This order matters — see
   CONVENTIONS.md's Status ownership section.

5. **Verify before finishing:**
   - Every relative link you added resolves to a real file.
   - Every section either has real content or is exactly the right placeholder
     (`N/A` vs. `Not started.` — CONVENTIONS.md explains the difference).
   - Testing evidence names what was *not* verified, not just what was — check this
     explicitly, it's the thing a documentation pass most easily drops.
   - Gotchas content that already exists elsewhere is linked, not duplicated.

6. **Report a short summary** of which files you created/changed and what changed in
   each. Do not commit — leave that to the user.
