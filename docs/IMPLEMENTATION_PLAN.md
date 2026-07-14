# ux-audit CLI — Implementation Plan

**Status: Phase 0 — next: `src/commands/app.ts` (`edit`)**
(update this line in the same commit as whatever task you just closed out)

This is the execution checklist. For *why* each decision was made, see
[`UX_AUDIT_CLI_PLAN.md`](./UX_AUDIT_CLI_PLAN.md) — that file is the source of truth for
architecture and rationale; this file just breaks it into ordered, file-level tasks.

`reference/ux-audit-skill/` is the old Claude-Code-native skill, kept **read-only** for
behavioral parity — its scenario field set, report shape, and executor prompt patterns
are the baseline this CLI should match or improve on, not reinvent from scratch.

## Repo layout

```
src/
  cli.ts                  — commander entry point
  commands/                — one file per subcommand, registers on the shared program
    init.ts
    app.ts
    scenario.ts
    guideline.ts
    run.ts
  config/
    schema.ts              — zod schemas (source of truth for on-disk shapes)
    paths.ts                — .ux-audit/* path resolution
    loader.ts                — read + validate config.json / app.json / scenarios / credentials
  backends/
    types.ts                — LlmBackend adapter interface
    claude-code.ts           — v1 backend
    codex.ts, gemini-cli.ts, api.ts — phase 4 stubs
    resolve.ts               — "auto" backend resolution
  browser/
    launch.ts                — Playwright + CDP endpoint
    mcp-bridge.ts             — @playwright/mcp subprocess bridge
  accessibility/
    axe-runner.ts             — AxeBuilder wrapper
  engine/
    run-scenario.ts           — per-scenario orchestration (steps 1-7)
    findings-handoff.ts        — file-based findings read/validate/retry
  report/
    schema.ts                 — structured Report zod schema
    synthesize.ts              — LLM-based cross-scenario synthesis
    render.ts                  — Report -> markdown
    templates/                 — copied from reference/ux-audit-skill/assets/
  types/index.ts              — shared TS types (mirrors config/schema.ts)
```

Everything above already exists as a stub (throws `not implemented — see
IMPLEMENTATION_PLAN.md Phase N`) and typechecks (`pnpm typecheck`). The phases below
fill them in, in order — each phase should leave `pnpm typecheck` clean and the
stated acceptance check passing before moving to the next.

## Testing strategy

See `UX_AUDIT_CLI_PLAN.md` Decision 7 for the rationale. TDD: `vitest` gets set up as
the very first Phase 0 task below, before `config/loader.ts` or any other stub gets
real logic — write the failing test first, then implement against it. Only
`config/schema.ts`, `config/paths.ts`, `config/loader.ts`, `backends/resolve.ts`, and
`report/render.ts` get unit tests — everything that needs a real browser or a real CLI
subprocess is verified by each phase's manual **Acceptance** check instead, not mocked.

## Phase 0 — Scaffolding & preflight

- [x] `package.json`, `tsconfig.json`, `.gitignore`
- [x] `src/` skeleton — all modules present as typed stubs
- [x] `vitest` devDependency + `pnpm test` script — set this up **first**, before any
      stub below gets real logic (TDD, see Testing strategy above). No test files yet;
      this task is just the runner + script wired up and passing on an empty suite.
- [x] Playwright browser binaries — `pnpm exec playwright install` (chromium at
      minimum) is a required one-time per-machine setup step, not covered by `pnpm
      install`; already noted in `README.md`'s Local setup. Leaning toward
      document-only for v1 rather than having `ux-audit init` detect and auto-install
      missing browsers — revisit if this trips people up in practice.
- [x] `src/config/loader.ts` (`loadConfig`, `loadAppOverview`) — write the failing
      test(s) against `config/schema.ts` validation first, then implement: real fs
      read + validation; throw a friendly "run `ux-audit init` first" error when
      `.ux-audit/` is missing, not a raw ENOENT/zod error. `loadScenarios`,
      `loadCredentials`, `loadGuideline` stay stubs — those are Phase 1/3 tasks below.
- [x] `src/commands/init.ts` — `@clack/prompts` flow: scaffold `.ux-audit/{config.json,
      app.json, scenarios/, guidelines/w3c.json}`, prompt for the `app.json` fields
      (name, one-paragraph description, core business model, target user segments —
      see `UX_AUDIT_CLI_PLAN.md` Decision 6), append `credentials.local.json` to
      `.gitignore`
- [ ] `src/commands/app.ts` (`edit`) — re-prompt and overwrite `app.json`
- [ ] `ClaudeCodeBackend.isAvailable()` in `src/backends/claude-code.ts` — detect
      `claude` on `PATH` and that it's logged in. **Needs a research spike**: there's no
      documented "am I logged in" flag; likely approach is checking for the CLI's local
      credential/session file, or a fast `claude -p` no-op call and checking for an auth
      error vs. a real response — confirm against current `claude --help` /
      `~/.claude` layout before committing to one.
- **Acceptance**: `ux-audit init` on a throwaway directory produces a valid
  `.ux-audit/`; running `ux-audit run` with no scenarios yet gives a clear, actionable
  error instead of a stack trace.

## Phase 1 — Single scenario, fixed W3C guideline, no picker

Prove the Playwright-CDP-endpoint + `@playwright/mcp` + `claude -p` loop end to end for
exactly one scenario, no picker, no concurrency.

- [ ] Scenario file format — markdown, same field set as
      `reference/ux-audit-skill/references/scenario-template.md` (App URL, App Name,
      App Persona, Auth, Session, Viewport, Output, free-text steps), except `Auth`
      takes a `credentialsRef` resolved from `credentials.local.json` instead of an
      inline email/password. Write the parser in `src/config/loader.ts`
      (`loadScenarios`) — reuse a markdown frontmatter-ish parse, not a new format.
- [ ] `src/commands/scenario.ts` (`add`) — copy the template into `.ux-audit/scenarios/`
- [ ] `src/browser/launch.ts` — launch Playwright with a remote-debugging port,
      `checkUrlReachable` mirroring the old skill's preflight
- [ ] `src/browser/mcp-bridge.ts` — spawn `@playwright/mcp` against that CDP endpoint,
      `--caps` excluding `browser_evaluate`, single (non-concurrent) `--user-data-dir`
      for now
- [ ] `src/backends/claude-code.ts` (`runScenario`) — spawn `claude -p` with
      `--mcp-config` + `--allowedTools` scoped to the bridge's tools, prompt = app
      overview + scenario steps, prompted to write findings JSON to the given path
- [ ] `src/engine/findings-handoff.ts` — read + validate against
      `ScenarioFindingsSchema`, retry once (re-prompt with the validation error) on
      failure, else surface `Status: ERROR`
- [ ] `src/accessibility/axe-runner.ts` — real `AxeBuilder` scan at each key state,
      `wcag22aa` tags only (guideline presets come in Phase 3)
- [ ] `src/engine/run-scenario.ts` — wire steps 1-7 together
- [ ] `src/commands/run.ts` — drop the "not implemented" and call `run-scenario` for a
      single resolved scenario (no `--scenario` parsing yet, just first scenario found)
- **Acceptance**: `ux-audit run` against a real local app produces one findings JSON
  file with real axe results and at least one LLM-authored finding.

## Phase 2 — Multi-scenario + picker + report synthesis + concurrency

- [ ] `src/commands/run.ts` — parse `--scenario a,b`; no flag → `@clack/prompts`
      multi-select checkbox over `loadScenarios()`
- [ ] Concurrency: run scenarios via a bounded pool (`--concurrency`, default 2 per
      `UX_AUDIT_CLI_PLAN.md` Open risks), each with its own `--isolated` (or distinct
      `--user-data-dir`) MCP bridge instance and CDP port
- [ ] `src/report/synthesize.ts` — LLM call (same backend abstraction) over all
      scenarios' findings JSON + `app.json`, cross-scenario dedup by element+dimension,
      returns `Report`
- [ ] `src/report/render.ts` — `Report` → markdown using
      `src/report/templates/{report-single,report-multi}.md`
- **Acceptance**: `ux-audit run` with 3 scenarios (2 passing, 1 seeded to fail) produces
  one combined report with a correctly deduped cross-scenario section, respects
  `--concurrency`.

## Phase 3 — Guideline presets + custom rules

- [ ] `src/config/loader.ts` (`loadGuideline`) + `.ux-audit/guidelines/*.json` —
      built-ins `w3c` (`wcag22aa`), `us-section508`, `eu-en301549`, each just a
      different axe `runOnly` tag set (see `UX_AUDIT_CLI_PLAN.md` Decision 3)
- [ ] `src/commands/guideline.ts` (`list`, `add`) — list built-ins + custom, `add` for
      user-defined tag sets / checklists
- [ ] `--guideline` flag on `run` wired through to `axe-runner.ts`
- **Acceptance**: switching `--guideline us-section508` changes which axe rules run,
  verified against a page with a known Section 508-only violation.

## Phase 4 — Additional LLM backends

One backend at a time, each a new MCP-config writer + subprocess shape behind the
existing `LlmBackend` interface — no interface changes expected.

- [ ] `src/backends/codex.ts` — `codex exec`, MCP entry in `.codex/config.toml`; note
      OpenAI's own docs recommend API-key auth (not ChatGPT sign-in) for CI/CD use
- [ ] `src/backends/gemini-cli.ts` — `gemini --non-interactive --yolo --output-format
      json`, `mcpServers` entry in `.gemini/settings.json`
- [ ] `src/backends/api.ts` — `@anthropic-ai/sdk`'s `toolRunner` + `betaZodTool` +
      `zodOutputFormat` (skip the file-handoff validate/retry path — schema conformance
      is SDK-enforced here)
- [ ] `src/backends/resolve.ts` — extend `AUTO_PREFERENCE_ORDER`, no other changes
- **Acceptance**: `--llmBackend codex` (and `gemini-cli`) complete the same Phase 1
  scenario end to end; `--llmBackend api` requires only `ANTHROPIC_API_KEY`, no CLI
  installed.

## Phase 5 — Polish, distribution, docs

- [ ] `npx ux-audit-cli` works from a clean install (verify `bin` entry + `dist/`
      build)
- [ ] `README.md` (quick start, requirements, scenario format) — not yet written;
      write once the command surface has stopped changing
- [ ] Error messages audit — every thrown error in the stubs above should have been
      replaced with a user-facing message, not a raw exception

## Open questions carried from the design plan

See `UX_AUDIT_CLI_PLAN.md` → **Open risks** for the full list (interactive-login
requirement, snapshot-driven login limits, structured-output conformance, concurrent
browser profiles, subscription rate-limit ceilings). Re-check each before closing the
phase it affects.
