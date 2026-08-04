# Phase & task documentation conventions

This is the source of truth for how `docs/phases/` is organized and how each file gets
written. `/document-task` (`.claude/commands/document-task.md`) reads this file — if you
change the convention, change it here, not inside that command.

## Layout

```
docs/IMPLEMENTATION_PLAN.md          — high-level tracker only: project overview,
                                        active phase, one line per phase, links out.
docs/phases/phase-N-<slug>/
  overview.md                        — that phase's task list + status, shared
                                        testing strategy, acceptance criterion.
  NN-<task-name>.md                  — one file per unit of work.
```

Three levels, and status lives on all three — see **Status ownership** below for which
one is authoritative.

## When to create a task file

Only once work on that task actually starts. A phase that hasn't started yet (e.g.
Phase 3/4 right now) has an `overview.md` with a Plan section listing what's coming,
and no task files — don't scaffold empty `NN-*.md` files ahead of time just for
uniformity. The first task file in a phase is created the first time someone actually
starts building one of the overview's Plan bullets.

## Task file template

```markdown
# Task: <what this task implements>

**Phase:** [N — <phase title>](./overview.md)
**Status:** not started | in progress | done

## Plan

<the original scope, as it was intended before implementation — see "Sourcing Plan" below>

## Implementation log

<what was actually built, and any signature/shape decisions worth recording>

## Testing evidence

<what was actually run/verified, with commit references — and what was NOT verified>

## Gotchas / drift from plan

<corrections and surprises discovered while implementing — or exactly `N/A`>
```

### Sourcing Plan — never derive it from what shipped

**Plan describes intent, written before or at the start of the work.** Pull it from
one of, in order:
1. The phase `overview.md`'s existing Plan bullet for this task (most common case —
   the phase overview already lists the planned files/behavior before any task file
   exists).
2. Other original planning text (e.g. `UX_AUDIT_CLI_PLAN.md`, a prior commit message,
   design notes) if the overview bullet is missing or too thin.
3. If neither exists, **ask the user** what was originally intended rather than
   reconstructing it from the diff or from Implementation log.

Writing Plan to match what was actually built defeats the whole point of this
structure: Gotchas exist to record *drift* from a plan, and a plan quietly rewritten
to match reality can never show drift. This is the single easiest way to make these
docs worthless — check it explicitly, not just when it's convenient.

### Implementation log

What was actually built. Note real decisions (signature changes, schema shape calls,
which option was picked and why) — skip narrating the diff line by line, the code
already shows that.

### Testing evidence

What was actually run, with a commit reference where one exists. Per
`UX_AUDIT_CLI_PLAN.md` Decision 7: deterministic/pure logic gets real unit tests cited
here (test file + case count); anything touching a real browser or a real CLI
subprocess is verified manually instead — say what was run against what (a real
`claude` CLI, a real local app, specific fixtures) and what it produced.

**Always record what was *not* verified**, not just what was. Every substantive task
file in this repo up to now carries an explicit "still not exercised" note (an
untested branch, a retry path never forced live, a walkthrough not re-run) — that's
the convention, not an accident. A diff shows what got done; it never shows what got
skipped, so this has to be written down deliberately or it's the first thing an
automated pass drops.

### Gotchas / drift from plan

Corrections, surprises, and drift discovered while implementing — the empirical
findings that would otherwise get lost (an installed tool version behaving differently
than docs suggest, a flag that doesn't do what was assumed, a bug root-caused after a
real failure). Carry these **verbatim**, including commit refs — they're the audit
trail, and paraphrasing loses the specific numbers/flags/error codes that make them
useful later.

## The N/A rule

A section with nothing to report gets exactly `N/A` — not "None specific to this
task", not a sentence explaining why there's nothing, not a pointer to where the real
content lives unless that pointer *is* the content (see Cross-referencing below). One
line, no padding. This applies to any section, most commonly Gotchas.

This is different from a section for work that **hasn't started yet**: that gets
`Not started.` (see Phase 5's not-yet-started task for the pattern) — `N/A` means
"nothing to report", `Not started.` means "nothing exists yet to report on". Don't
conflate the two.

## Status ownership

Three places carry status; they are not equally authoritative. Update in this order
when you close out a task or hit something that changes status:

1. **The task file's `Status:` field** — authoritative. Update this first.
2. **The phase `overview.md` checklist** — a summary of the task files, updated second.
3. **`IMPLEMENTATION_PLAN.md`'s "Active phase" line and Phases table** — the top-level
   summary, updated third.

If these ever disagree, the task file wins. A phase can be `partially done` (see
Phase 5) when some of its tasks are done and others aren't — say so in the overview
rather than picking one status that's true for only part of the phase.

## Filenames

Full words, kebab-case, no abbreviations (`04-claude-code-backend-run-scenario.md`,
not `04-cc-backend.md`) — matches this repo's general no-abbreviated-names convention.
`NN-` prefix is a zero-padded two-digit index in build/dependency order, not
alphabetical order. The name should name the actual file/module/command the task
implements, not a vague label.

## Cross-referencing

When one piece of content is relevant to two tasks or two phases (a schema shipped in
Phase 1 that Phase 2 retroactively extends; a fix in one backend call reused by
another), it gets **one home** — the task that owns/ships it — and a **link** from the
other side. Never duplicate the paragraph. If you're tempted to copy a Gotcha into a
second file "for visibility", link instead; the reader follows one hop.

Verify every relative link you add actually resolves to a real file before moving on —
broken links in this tree have no other check catching them.
