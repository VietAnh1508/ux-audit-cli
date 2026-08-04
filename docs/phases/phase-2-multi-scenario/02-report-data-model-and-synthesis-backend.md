# Task: Report data model + `report/synthesize.ts` + backend `synthesizeReport`

**Phase:** [2 — Multi-scenario + picker + report synthesis + concurrency](./overview.md)
**Status:** done

This task merges the plan's original sections 3-5 — they were built and verified
together, and the testing evidence was never split three ways.

## Plan

### Report data model — extend, don't invent at synthesis time

Current `ReportSchema` (`src/report/schema.ts`) is just
`{crossScenarioFindings: Finding[], sections: [{scenarioSlug, findings}]}` — missing
everything `report-single.md`/`report-multi.md` actually need (Executive Summary,
screen-by-screen notes, Quick wins, Feature suggestions, and "appears in" scenario
attribution on cross-scenario findings). Since `render.ts` is pure templating with no
LLM call of its own (Decision 7 — unit tested, not mocked-subprocess tested), all of
that content has to already exist as structured data by the time `render.ts` runs —
which means both `ReportSchema` **and** Phase 1's `ScenarioFindingsSchema` need
extending, not just this phase's files:

- `src/config/schema.ts` / `src/types/index.ts`:
  - New `ScreenNoteSchema` / `ScreenNote`: `{name, state?, observations}`.
  - `ScenarioFindingsSchema` gains `screens: z.array(ScreenNoteSchema).default([])`.
    **This is a retroactive change to Phase 1's shipped schema** — see
    [`phase-1-single-scenario/00-scenario-file-format-and-loader.md`](../phase-1-single-scenario/00-scenario-file-format-and-loader.md)
    for the cross-reference.
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
    scenario stopped), and `screens: z.array(ScreenNoteSchema).default([])` — named
    `screens`, matching `ScenarioFindingsSchema.screens` exactly rather than
    `screenNotes` as originally planned (see Gotchas).
  - `ReportSchema` gains `appName` (passthrough from `AppOverview`, so `render.ts` stays
    self-contained on just a `Report`), `executiveSummary: string`,
    `quickWins: z.array(z.string()).default([])`,
    `featureSuggestions: z.array(z.string()).default([])`. `quickWins`/
    `featureSuggestions` are already-deduplicated, report-level lists (the old skill's
    "Combined quick wins" behavior) — synthesis produces one unified list, not
    per-scenario ones.

### `src/report/synthesize.ts`

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

### `src/backends/types.ts` + `claude-code.ts` — `synthesizeReport` signature

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
`--setting-sources ""` + `cwd: tmpdir()` contamination guards as `runScenario` (see
[`phase-1-single-scenario/04-claude-code-backend-run-scenario.md`](../phase-1-single-scenario/04-claude-code-backend-run-scenario.md)).
Reuse `createStreamJsonLogger` for live progress. Separate, shorter timeout constant (no
browser work happening, should be fast) rather than reusing `RUN_TIMEOUT_MS`.

## Implementation log

Built and wired up as planned, with one signature-level deviation from the plan text
above: `SynthesizeReportOptions` carries already-parsed `scenarioFindings`, not raw
`findingsPaths` — see Gotchas.

## Testing evidence

- Smoke-tested end-to-end against the real `claude` CLI via
  `test/manual/synthesize-report.ts` and the fixtures in
  `test/fixtures/scenario-findings/`: `login`/`checkout` share one underlying issue
  (low-contrast CTA button) worded differently in each; `checkout-mobile` is `BLOCKED`
  with no findings. Result: `crossScenarioFindings` correctly deduped the CTA issue into
  one entry with `appearsIn: ["login", "checkout"]`, `sections` passed through each
  scenario's exact `findings`/`screens`/`notes` verbatim (unparaphrased, including the
  `BLOCKED` scenario's `notes`), `quickWins`/`featureSuggestions` were sensible and
  deduplicated, and the assembled object passed `ReportSchema.parse()`. Ran in ~13-25s
  per attempt (no retry path exercised). Also confirmed empirically that dropping
  `--mcp-config` entirely while keeping `--strict-mcp-config` + `--setting-sources ""`
  yields `"mcp_servers":[]` in the subprocess's init event — no global MCP server
  leakage into the synthesis call. `pnpm typecheck` and `pnpm test` clean throughout.
- Manually confirmed the single-scenario synthesis path (the most common invocation,
  previously unexercised by `test/manual/synthesize-report.ts`'s 3-fixture run) against
  the real `claude` CLI: `synthesizeReport()` with just the `login` fixture produced
  `crossScenarioFindings: []` and a report that passed `ReportSchema.parse()`,
  confirming the single-scenario prompt guardrail below works.

## Gotchas / drift from plan

- **Single-scenario synthesis needed an explicit prompt guardrail.** `ReportSchema`'s
  `CrossScenarioFindingSchema` requires `appearsIn.length >= 2`, which is unsatisfiable
  when only one scenario was audited — without an explicit instruction, a model that
  hallucinated a single-scenario "cross-scenario" finding would fail validation, retry,
  fail again, and `synthesizeReport` would throw on the single-scenario case (the most
  common invocation). `buildSynthesisPrompt` in `claude-code.ts` now adds an explicit
  line when `scenarioFindings.length < 2` stating cross-scenario comparison is
  impossible and `crossScenarioFindings` MUST be `[]`. Confirmed against the real
  `claude` CLI with the `login` fixture alone: `crossScenarioFindings: []`, full report
  passed `ReportSchema.parse()`.
- **`ReportSectionSchema` turned out to be identical to `ScenarioFindingsSchema` —
  unified into one schema instead of two.** The plan (as originally written) had
  `ReportSectionSchema` as its own `screenNotes`-named object; the first pass at this
  renamed that field to `screens` to avoid a silent-data-loss risk (a model echoing
  `ScenarioFindings.screens` verbatim into a `screenNotes`-shaped section would validate
  as an empty array with no error, since `screenNotes` defaults to `[]`). Once renamed,
  every other field matched too — `report/schema.ts` now defines
  `ReportSectionSchema = ScenarioFindingsSchema` (imported from `config/schema.ts`)
  rather than a hand-duplicated copy, which also means `synthesize.ts` needs no
  scenario-findings-to-report-section mapping step: `sections: scenarioFindings` is
  already the right shape.
- **The LLM is only asked for a narrow `SynthesisOutputSchema`, not the full `Report`.**
  `sections` (per-scenario findings/screens/status/notes) and `appName` are assembled by
  `report/synthesize.ts` from each scenario's already-validated `ScenarioFindings`, not
  regenerated by the synthesis prompt — the model only produces `executiveSummary`,
  `crossScenarioFindings`, `quickWins`, `featureSuggestions`. Otherwise the model would be
  re-authoring every per-scenario finding from scratch, including the axe-derived ones
  `run-scenario.ts` appends with exact `help`/`helpUrl` strings, risking paraphrasing or
  silent drops. `SynthesisOutputSchema` is derived as `ReportSchema.omit({appName: true,
  sections: true})` rather than redeclaring those four fields, so the two can't drift.
  The assembled object is still run through `ReportSchema.parse()` as a cheap self-check.
- **`SynthesizeReportOptions` carries already-parsed `scenarioFindings`, not raw
  `findingsPaths`** (a deviation from the plan's literal signature above).
  `synthesize.ts` reads and schema-validates each findings file once (via
  `findings-handoff.ts`'s `tryReadJson`); the backend embeds that same in-memory data
  into its prompt instead of re-reading and re-parsing the files itself. An earlier
  version threaded `findingsPaths` through to `ClaudeCodeBackend.synthesizeReport`, which
  read each file a second time (a third time on the validation retry) just to pull out
  `scenarioSlug` for a prompt heading — caught and fixed via `/simplify`.
- **`ClaudeCodeBackend.synthesizeReport` drops `--mcp-config` entirely** (no browser
  tools needed) but keeps `--strict-mcp-config` — confirmed via a smoke run that this
  combination, together with the existing `--setting-sources ""`, still yields
  `"mcp_servers":[]` in the subprocess's init event, so the user's global/project MCP
  servers (claude-in-chrome, context7, etc.) never get discovered for this call either.
- **Retroactively extends Phase 1's `ScenarioFindingsSchema`** (adds `screens`) and
  `claude-code.ts`'s `buildPrompt()` (asks the agent to record screen notes as
  structured data, not just prose) — discovered while scoping this phase, not a Phase 1
  oversight at the time (Phase 1 never needed screen-level data, only this phase's
  screen-by-screen report section does). See
  [`phase-1-single-scenario/00-scenario-file-format-and-loader.md`](../phase-1-single-scenario/00-scenario-file-format-and-loader.md)
  for the cross-reference.
