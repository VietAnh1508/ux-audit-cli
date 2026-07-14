# ux-audit CLI — Design Plan

Status: brainstorm / not yet implemented.

## Context

The `ux-audit` skill (reference folder) is a Claude-Code-native markdown skill: an
orchestrator spawns one executor sub-agent per scenario, each executor drives the
Claude in Chrome browser extension to walk a scenario and judge the UX. It works, but:

1. Can point at one scenario file or a whole directory, but not a **chosen subset**
   — pass a directory and it runs *every* `*.md` file in it (Mode A-multi in
   `SKILL.md`). There's no way to say "run these 3 of these 7 stored scenarios" in one
   invocation; the only workaround is invoking the skill once per file.
2. No accessibility standard presets — just an ad-hoc checklist with a **visual estimate**
   for contrast, no real rule engine.
3. Hard-depends on Claude Code + the Claude in Chrome extension — can't run headless
   or unattended (e.g. a scheduled job), and ties the tool to whichever machine has
   that extension installed and permissioned.
4. No credential/config management — scenario files hold raw credentials inline.

This plan replaces those four gaps with a CLI tool.

## Decisions already made

1. **Own the browser and accessibility engine; borrow the LLM.** The CLI owns
   Playwright (browser automation) and axe-core (accessibility scanning) directly —
   no dependency on Claude Code or Claude in Chrome for those. But for the agentic
   "drive the browser, judge the UX" loop, the default path shells out to an
   **already-installed, already-authenticated coding CLI** (Claude Code first; Codex
   CLI / Gemini CLI later — see "LLM backend" below) instead of calling the Anthropic
   API directly. Rationale: `claude -p` (and the Codex/Gemini equivalents) run
   non-interactively under the user's existing subscription login (Pro/Max, ChatGPT
   Plus/Pro, or a cached Google OAuth session) with **no separate per-token API
   billing**, once that CLI has been logged in interactively at least once. An
   opt-in `api` backend (`@anthropic-ai/sdk`, real token billing) is kept for
   environments with no pre-authenticated CLI available, e.g. a bare CI runner —
   see Decision 5. This does mean the tool is no longer dependency-free by default;
   that trade is deliberate (subscription cost vs. standalone portability), not an
   oversight.
2. **Credentials**: plain local config file, gitignored. These are dedicated test
   accounts, not production secrets, so simplicity wins for v1 (no OS keychain, no
   env-var-only scheme).
3. **Accessibility presets**: ship W3C (WCAG 2.2 AA) as default, plus custom rules.
   Confirmed via axe-core docs: its `runOnly` tag system already includes `wcag22aa`
   (W3C), `section508` (US), and `EN-301-549` (EU), all mapped to the same rule engine —
   so US/EU "presets" are just different tag-set selections, not separate rule sets to
   build from scratch.
4. **Scenario selection**: interactive checkbox picker when running `ux-audit run` with
   no args, plus `--scenario name1,name2` flags for scripted/CI use.
5. **LLM backend, v1 scope: Claude Code only.** Build the backend as a pluggable
   adapter interface from the start, but ship and prove only the `claude-code`
   adapter in v1 — one MCP config format, one permission-flag model, lowest
   integration risk. Codex CLI and Gemini CLI adapters are a later phase once the
   pattern is validated (see Phased build order). `config.json` still takes an
   `llmBackend` field (`"auto" | "claude-code" | "codex" | "gemini-cli" | "api"`) so
   adding adapters later is additive, not a redesign. `"auto"` tries installed,
   logged-in CLIs in preference order and falls back to `"api"` only if an
   `ANTHROPIC_API_KEY` is set and no CLI is available.
6. **App overview, stored once at the project level.** Add an `app.json` (business
   context: what the app does, core business model, main target users/segments) that
   is set up once via `ux-audit init` and reused across every scenario and report run —
   distinct from the per-scenario `App Persona` field, which stays scoped to the
   persona/state for *that scenario* (e.g. "first-time visitor" vs. "returning power
   user on the free tier"). Rationale: business context (who this is for, what "success"
   looks like commercially) shapes how a friction point should be *prioritized* — e.g. a
   confusing paywall step is more severe for a subscription-first business than for an
   ad-supported one — and today's skill has no way to express that at all; it either
   goes unstated or gets awkwardly repeated into every scenario file's one-line persona
   field. Fed as shared context into both the journey-walk prompt (step 4 of the
   execution engine) and the report-synthesis call, so severity judgments and framing
   are business-aware, not just screen-by-screen.

## Tech stack

| Concern              | Choice                                       | Why                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language/runtime     | TypeScript on Node.js                        | Matches the npx-distribution convention this ecosystem already uses                                                                                                                                                                                                                                                                          |
| CLI framework        | `commander`                                  | Mature, minimal, standard for subcommands + flags                                                                                                                                                                                                                                                                                            |
| Interactive prompts  | `@clack/prompts`                             | Clean multi-select checkbox UI for scenario picking                                                                                                                                                                                                                                                                                          |
| Browser automation   | `playwright`                                 | Owns the browser process directly; launched with a CDP endpoint so the LLM backend's tool calls and our own deterministic steps (axe scan, screenshot capture) share the same live page                                                                                                                                                    |
| Accessibility engine | `@axe-core/playwright` (`AxeBuilder`)        | `new AxeBuilder({page}).withTags([...]).analyze()` — real, deterministic rule engine (replaces the old skill's visual-estimate contrast check). Run directly by our code, not through the LLM                                                                                                                                              |
| Browser tool exposure | `@playwright/mcp` (Microsoft, official)     | Reuse rather than hand-roll a tool bridge. Launched as a subprocess pointed at our own browser via `--cdp-endpoint`, with `--caps` scoped to safe navigation/input capabilities only (no `browser_evaluate`/arbitrary code execution). Confirmed current via context7 (`/microsoft/playwright-mcp`)                                        |
| LLM backend (v1)     | Claude Code CLI (`claude -p`), non-interactive | Spawned as a subprocess with `--mcp-config` pointing at the `@playwright/mcp` server above and `--allowedTools` scoped to just that server's tools, so no blanket permission bypass is needed. Runs under the user's existing Claude subscription login — no `@anthropic-ai/sdk` calls, no separate API key, for the default path         |
| LLM backend (opt-in) | `@anthropic-ai/sdk`                          | Kept as the `api` backend for CI/headless environments with no pre-authenticated CLI. `client.beta.messages.toolRunner` + `betaZodTool` over the same Playwright tool set, `zodOutputFormat` for structured findings — this is the only backend where schema conformance is enforced by the SDK rather than by prompting                  |
| Structured findings  | file-based JSON handoff (default) / `zodOutputFormat` (`api` backend) | For CLI backends: prompt the agent to write findings JSON to a known path, then read + validate that file against our schema after the subprocess exits (retry once on validation failure) — mirrors the existing skill's proven "write findings to a file" pattern and sidesteps each CLI's differing `--output-format` conventions      |

## Config/data layout (per project using the CLI)

```
.ux-audit/
  config.json              — default guideline, concurrency limit, output dir,
                              llmBackend ("auto"|"claude-code"|"codex"|"gemini-cli"|"api")  (committed)
  app.json                 — { "name", "description", "coreBusiness", "targetUsers" }  (committed)
  scenarios/
    sign-up.md             — scenario definition, NO secrets                   (committed)
    core-loop.md
  credentials.local.json    — { "sign-up": {email, password}, ... }            (gitignored)
  guidelines/
    w3c.json                — default: axe tags [wcag22aa] + custom checklist  (committed)
    my-custom.json          — user-defined
```

Scenario files keep the existing field set (App URL, App Name, Persona, Session,
Viewport, Output) but replace inline `Auth: email/password` with `Auth: <credentialsRef>`,
resolved at runtime from the gitignored file. `ux-audit init` scaffolds this directory,
prompts for the `app.json` fields (name, one-paragraph description, core business
model, main target user segments), and adds `credentials.local.json` to `.gitignore`
automatically.

## Command surface

- `ux-audit init` — scaffold `.ux-audit/`, write gitignore entry, prompt for `app.json`
- `ux-audit app edit` — update the stored app overview (name, description, core
  business, target users) without re-running the full `init` flow
- `ux-audit scenario add|list|remove`
- `ux-audit guideline list|add` (built-ins: `w3c` default, `us-section508`,
  `eu-en301549` — all axe tag-set variants; `add` for custom checklists)
- `ux-audit run [--scenario a,b] [--guideline w3c] [--headed] [--concurrency N] [--output path]`
  — no `--scenario` → interactive checkbox picker over discovered scenarios

## Execution engine, per scenario

1. Resolve scenario + credentials + `app.json` (app overview: description, core
   business, target users).
2. Launch Playwright with a remote-debugging port (CDP endpoint), apply viewport,
   preflight-check the URL reachability (mirrors the old skill's check).
3. Start `@playwright/mcp` as a subprocess pointed at that CDP endpoint (`--isolated`
   or a distinct `--user-data-dir` per concurrent scenario — persistent profiles can't
   be shared across concurrent clients, see Open risks).
4. **Auth + journey walk, combined** — spawn the LLM backend (`claude -p` by default)
   non-interactively with the scenario's free-text steps and the `app.json` overview
   (prepended as shared business context — what the app does, who it's for, what the
   business optimizes for) as the prompt, the
   `@playwright/mcp` server registered via `--mcp-config`, and tool use pre-approved
   via `--allowedTools` scoped to that server only. Because the backend drives the
   browser through accessibility snapshots (not raw selectors), it can log in
   adaptively the same way the old Claude-in-Chrome skill did — no separate
   selector-heuristic auth step is needed. An **optional selector hint** in the
   scenario file remains available as a fallback for apps where snapshot-driven login
   struggles (e.g. custom widgets with poor ARIA labeling), but it is not the primary
   mechanism. Screenshot at each key state; prompt the agent to note visual/subjective
   judgment inline as it walks (hierarchy, CTA clarity, copy, friction, empty/loading
   states, feedback, density, mobile readiness, confusion) rather than a separate call
   per screenshot — one subprocess spawn per scenario, not per screenshot.
5. **Accessibility** — our own code runs `AxeBuilder` scans at each key state directly
   against the shared page (not through the LLM), filtered by the selected guideline's
   axe tags.
6. Agent writes structured findings JSON to a known path as its last step; our code
   reads and validates that file against our schema, retrying once (re-prompting with
   the validation error) if it doesn't conform — the `api` backend skips this because
   `zodOutputFormat` enforces the schema server-side.
7. Assemble structured findings JSON (not markdown) for that scenario.

## Report synthesis

Keep single/multi-scenario synthesis as an **LLM call**, not pure templating —
cross-scenario dedup ("same element+dimension across scenarios") needs judgment, not
string matching. Feed it the structured findings JSON from all scenarios, plus the same
`app.json` overview used during the walk, via the same LLM backend abstraction (no
browser tools needed for this call, just prompt + file I/O), get back a structured
report object, then template it to markdown (reusing the old skill's report shape:
Executive Summary → High/Medium/Low impact → Screen notes → Quick wins → Feature
suggestions). The app overview lets synthesis weigh severity/priority against what the
business actually cares about (e.g. bump a checkout-flow issue above a settings-page
issue for an e-commerce app), not just generic UX heuristics.

## Open risks

- **Requires the backend CLI installed and already logged in interactively** — headless
  OAuth login doesn't work for any of the three tools (confirmed for Claude Code,
  Codex CLI, Gemini CLI). `ux-audit init` (or a preflight check before `run`) must
  detect this and give a clear "run `claude` once interactively first" error rather
  than failing deep inside a scenario run.
- **Snapshot-driven login may still fail on some apps** — downgraded from the original
  "main engineering risk" now that the LLM drives via accessibility snapshots rather
  than raw selectors (same mechanism the old Claude-in-Chrome skill used
  successfully), but not eliminated — bad ARIA labeling, custom auth widgets, or CAPTCHAs
  can still trip it up. Keep the optional selector-hint fallback from day one.
- **Agent wandering off-task** on vague scenario steps — mitigate with an
  iteration/turn cap (`claude -p`'s equivalent of `max_iterations`) + a system prompt
  that scopes the tool loop tightly to "one step at a time, confirm state before
  proceeding."
- **Structured-output conformance isn't guaranteed** for CLI backends — unlike
  `zodOutputFormat` on the `api` backend, `claude -p` (and later Codex/Gemini) can
  write malformed or incomplete findings JSON. The validate-and-retry-once step in
  the execution engine is the mitigation, but a persistent-failure path (surface the
  scenario as `ERROR`, same as the old skill's Chrome-unavailable case) is needed too.
- **Concurrent browser profiles** — `@playwright/mcp` can't share a persistent profile
  across concurrent clients; each parallel scenario needs its own `--isolated` context
  or distinct `--user-data-dir` plus its own CDP endpoint/port. `--concurrency` needs
  to account for this resource cost, not just cost/rate-limit pressure.
- **Cost/concurrency is now a subscription rate-limit ceiling, not API spend** — each
  scenario spawns its own CLI subprocess session; concurrent scenarios compete for the
  same account's usage limits (Claude Pro/Max, ChatGPT Plus/Pro, etc.), which are
  typically stricter than pay-as-you-go API limits. `--concurrency` should still
  default low (e.g. 2).

## Phased build order

0. Scaffolding (CLI skeleton, config dir, `init`, backend preflight check for an
   installed + logged-in Claude Code CLI)
1. Single scenario, fixed W3C guideline, no picker — prove the
   Playwright-CDP-endpoint + `@playwright/mcp` + `claude -p` loop works end to end,
   including the file-based findings handoff and validate-and-retry
2. Multi-scenario + interactive picker + cross-scenario report dedup + concurrency
   (isolated browser profiles per scenario)
3. Guideline presets (US/EU tag variants) + custom rule definitions
4. Additional LLM backends: Codex CLI adapter, then Gemini CLI adapter, then the
   opt-in `api` (`@anthropic-ai/sdk`) fallback — each is a new MCP-config writer +
   subprocess invocation shape behind the same adapter interface proven in phase 1
5. Polish, npx distribution, docs

