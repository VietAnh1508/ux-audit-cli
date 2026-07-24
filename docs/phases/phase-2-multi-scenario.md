# Phase 2 — Multi-scenario + picker + report synthesis + concurrency

Status: **not started**. See [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for
current overall status.

## Plan

### 1. Scenario selection — `src/commands/run.ts`

- `--scenario a,b`: split on comma, trim, validate each slug against `loadScenarios()`.
  Unknown slugs → error listing exactly which ones aren't found (not a generic failure).
- No `--scenario`, exactly 1 scenario on disk → run it immediately (Phase 1 behavior,
  unchanged).
- No `--scenario`, 0 scenarios → error (unchanged).
- No `--scenario`, >1 scenarios → `@clack/prompts` `multiselect` checkbox over
  `loadScenarios()`, one line per scenario reusing `formatScenarioSummary`-style detail
  (slug + viewport + session + auth) from `commands/scenario.ts`. Cancelled picker or
  empty selection → exit 1, same `exitOnCancel` pattern already used in
  `commands/scenario.ts`.

### 2. Concurrency

- Add `p-limit` as a real dependency (not currently in `package.json`) rather than
  hand-rolling a semaphore — small, mature, does exactly this.
- `run.ts` resolves the backend **once** up front (`resolveBackend` + `isAvailable`
  preflight) instead of once per scenario, and passes that resolved `backend` into
  `runScenario` as a new parameter — small signature change to
  `src/engine/run-scenario.ts` (currently re-resolves internally). Avoids N redundant
  `claude auth status` shellouts and gives synthesis (step 4 below) the same backend
  instance.
- `const limit = pLimit(Number(options.concurrency) || config.concurrency)`, map
  selected scenarios through `limit(() => runScenarioSafely(...))`, `Promise.all`.
- **No new isolation work needed for concurrency itself** — `launchBrowser()` already
  grabs a fresh free port per call and `mcp-bridge.ts` already gets its own free port +
  unique `mkdtemp` `userDataDir` per scenario (Phase 1 built this in without realizing
  it'd be load-bearing for Phase 2). Confirm this holds under real concurrent load as
  part of this phase's acceptance check, but no plumbing changes expected.
- `runScenario` already returns `{status: "ERROR", ...}` findings rather than throwing
  on most failure paths — but wrap each pooled call in try/catch anyway (export
  `errorFindings` from `run-scenario.ts`) so one scenario's unexpected exception can't
  reject the whole `Promise.all` and lose the other scenarios' results.

### 3. Report data model — extend, don't invent at synthesis time

Current `ReportSchema` (`src/report/schema.ts`) is just
`{crossScenarioFindings: Finding[], sections: [{scenarioSlug, findings}]}` — missing
everything `report-single.md`/`report-multi.md` actually need (Executive Summary,
screen-by-screen notes, Quick wins, Feature suggestions, and "appears in" scenario
attribution on cross-scenario findings). Since `render.ts` is pure templating with no
LLM call of its own (Decision 7 — unit tested, not mocked-subprocess tested), all of
that content has to already exist as structured data by the time `render.ts` runs —
which means both `ReportSchema` **and** Phase 1's `ScenarioFindingsSchema` need
extending, not just Phase 2's files:

- `src/config/schema.ts` / `src/types/index.ts`:
  - New `ScreenNoteSchema` / `ScreenNote`: `{name, state?, observations}`.
  - `ScenarioFindingsSchema` gains `screens: z.array(ScreenNoteSchema).default([])`.
    **This is a retroactive change to Phase 1's shipped schema** — see the
    cross-reference added to `phase-1-single-scenario.md`'s Gotchas.
- `src/backends/claude-code.ts` `buildPrompt()`: the findings JSON shape instructions
  need a `screens` array alongside `findings`, and the current prose-only instruction
  ("note the screen name/state as you go") needs to become a concrete instruction to
  record each key state as a `{name, state, observations}` entry — otherwise synthesis
  still has nothing to draw screen notes from.
- `src/report/schema.ts`:
  - `CrossScenarioFindingSchema = FindingSchema.extend({appearsIn: z.array(z.string()).min(2)})`
    — scenario slugs (there's no separate scenario "name" field anywhere in
    `ScenarioConfig`, just `slug`, so slugs are what "appears in" references).
  - `ReportSectionSchema` gains `status` (OK/ERROR/BLOCKED, passed through from that
    scenario's `ScenarioFindings`), `notes?` (same passthrough — e.g. why a `BLOCKED`
    scenario stopped), and `screenNotes: z.array(ScreenNoteSchema).default([])`.
  - `ReportSchema` gains `appName` (passthrough from `AppOverview`, so `render.ts` stays
    self-contained on just a `Report`), `executiveSummary: string`,
    `quickWins: z.array(z.string()).default([])`,
    `featureSuggestions: z.array(z.string()).default([])`. `quickWins`/
    `featureSuggestions` are already-deduplicated, report-level lists (the old skill's
    "Combined quick wins" behavior) — synthesis produces one unified list, not
    per-scenario ones.

### 4. `src/report/synthesize.ts`

- Reads each scenario's findings JSON off disk directly (`fs/promises readFile` — same
  as `buildPrompt` embeds scenario steps as text) and embeds all of them plus
  `appOverview` into one prompt, rather than giving the synthesis subprocess file-read
  tool access.
- Calls `backend.synthesizeReport(...)`, then does its own read-and-validate-against-
  `ReportSchema` with one retry — mirrors `runScenario`'s split between
  `backend.runScenario()` (writes a file) and `findings-handoff.ts` (reads + validates
  it), not a single black-box call.
- `src/engine/findings-handoff.ts` needs generalizing: extract the "read JSON, safeParse
  against a schema, call a retry callback once on failure" skeleton into a generic
  helper both `runScenario`'s findings handoff and this new report handoff call —
  they diverge only in what happens on a *second* failure (`ScenarioFindings` synthesizes
  a `{status: "ERROR"}` object; report synthesis has no such status field, so it throws
  and `run.ts` reports synthesis failure while still keeping the already-written
  per-scenario findings JSON files on disk).

### 5. `src/backends/types.ts` + `claude-code.ts` — `synthesizeReport` signature

Current stub signature (`synthesizeReport(findingsPaths, appOverview): Promise<unknown>`)
doesn't fit the write-then-read-back pattern the rest of this backend uses. Change to
match `runScenario`'s shape:

```ts
synthesizeReport(options: {
  findingsPaths: string[];
  appOverview: AppOverview;
  outputPath: string;
  previousValidationError?: string;
}): Promise<void>
```

`ClaudeCodeBackend.synthesizeReport` spawns `claude -p` with **no `--mcp-config` at
all** (no browser tools needed for this call) and `--allowedTools "Write"` only, same
`--setting-sources ""` + `cwd: tmpdir()` contamination guards as `runScenario`. Reuse
`createStreamJsonLogger` for live progress. Separate, shorter timeout constant (no
browser work happening, should be fast) rather than reusing `RUN_TIMEOUT_MS`.

### 6. `src/report/render.ts`

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

### 7. Wiring it up in `run.ts`

- After the concurrency pool resolves, write each scenario's findings JSON to
  `${outputDir}/${slug}-findings.json` (unchanged from Phase 1, just done per-item
  instead of once).
- Call `synthesizeReport(backend, findingsPaths, appOverview)` → `Report`.
- `renderMarkdown(report, mode)` → markdown string.
- Output path precedence, matching the old skill and the plan's `--output` flag:
  `options.output` → (single-scenario only) that scenario's `Output:` field →
  `path.join(config.outputDir, "UX_AUDIT.md")`.
- Exit code 1 if any scenario's status wasn't `OK`, or synthesis itself failed.

**Acceptance**: `ux-audit run` with 3 scenarios (2 passing, 1 seeded to fail) produces
one combined report with a correctly deduped cross-scenario section, respects
`--concurrency`.

## Testing strategy

`report/render.ts` is pure templating logic → unit tested (per `UX_AUDIT_CLI_PLAN.md`
Decision 7): single vs. multi mode, severity grouping, cross-scenario `appearsIn`
rendering, and empty `screenNotes`/`quickWins`/`featureSuggestions` arrays rendering
sensibly (not literal `[]` or empty headers). Concurrency, the picker, and
`synthesize.ts`'s LLM call are covered by this phase's manual **Acceptance** check
instead — same reasoning as Phase 1: mocking a subprocess would test the mock.

## Testing evidence

_Not started._

## Gotchas / drift from plan

- **Retroactively extends Phase 1's `ScenarioFindingsSchema`** (adds `screens`) and
  `claude-code.ts`'s `buildPrompt()` (asks the agent to record screen notes as
  structured data, not just prose) — discovered while scoping this phase, not a Phase 1
  oversight at the time (Phase 1 never needed screen-level data, only Phase 2's
  screen-by-screen report section does). See
  [`phase-1-single-scenario.md`](./phase-1-single-scenario.md) Gotchas for the
  cross-reference.
