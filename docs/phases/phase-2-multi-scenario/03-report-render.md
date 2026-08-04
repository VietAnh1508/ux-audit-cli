# Task: `src/report/render.ts`

**Phase:** [2 — Multi-scenario + picker + report synthesis + concurrency](./overview.md)
**Status:** done

## Plan

Pure string templating against the extended `Report` shape, no subprocess:

- `mode: "single"` — `report.sections[0]`'s findings grouped by severity into
  High/Medium/Low, its `screenNotes`, plus `executiveSummary`/`quickWins`/
  `featureSuggestions` — filling `templates/report-single.md`'s shape.
- `mode: "multi"` — `crossScenarioFindings` (with "appears in: <slugs>") first, then one
  `## Scenario: <slug>` subsection per `report.sections[]` entry (including a note for
  any non-`OK` section, matching the old skill's "tell the user which scenario
  failed/blocked" behavior), then the combined `quickWins`/`featureSuggestions` —
  filling `templates/report-multi.md`'s shape.
- Mode is chosen by `run.ts` based on how many scenarios were actually run (1 → single,
  >1 → multi), not by anything in `Report` itself.

## Implementation log

Pure templating logic, no LLM call — implemented and unit tested per the phase's
testing strategy.

## Testing evidence

- Unit tested: `src/report/render.test.ts` covers single mode (title/executive
  summary, severity grouping with only non-empty severities rendered and
  high-before-low ordering, screen notes with and without optional `state`, a
  non-`OK` section's status/notes surfaced as a blockquote, and empty
  `screens`/`quickWins`/`featureSuggestions` all omitting their section headers
  entirely — no literal `[]` or dangling headings), and multi mode (scenario count +
  slug list in the title, cross-scenario findings rendering `appearsIn`, one
  `## Scenario:` subsection per section including a status note for the `BLOCKED`
  one, "no cross-scenario issues" fallback text when that list is empty, and
  `Combined quick wins`/`Combined feature suggestions` headers — the latter omitted
  when empty). `pnpm typecheck` and `pnpm test` clean (28 tests passing across the two
  test files in the repo at the time).

## Gotchas / drift from plan

- **`render.ts` omits the templates' "_Audited on {date}._" line.** `ReportSchema` has
  no date field — the plan for `render.ts` also never mentions one — so rendering a
  date would mean either inventing a schema field beyond what was planned or calling
  `new Date()` inside a function this phase's testing strategy specifies as unit
  tested, which would make output non-deterministic across runs. Left out rather than
  invented; `run.ts` (see [04-run-command-wiring.md](./04-run-command-wiring.md)) is the
  more natural place to stamp a generation timestamp onto the written file if that's
  wanted later.
