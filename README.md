# ux-audit CLI

A standalone CLI that walks a web app's user journeys in a real browser and produces a
structured UX audit report — combining Playwright + axe-core with an agentic loop that
shells out to an already-authenticated coding CLI (Claude Code by default) to judge UX.

This is a placeholder. The full README (requirements, scenario format reference, error
message catalog) is scoped for Phase 5, once the command surface stops changing — see
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md). Basic usage below is
accurate today.

## Beta builds

For teammates trying the CLI before the real release: this always installs the latest
beta build (re-run it to pick up new ones):

```
npm install -g https://github.com/VietAnh1508/ux-audit-cli/releases/latest/download/ux-audit-cli.tgz
```

Requires Node ≥ 20, an already-authenticated `claude` CLI on PATH, and
`npx playwright install chromium` run once. `ux-audit --version` shows which build
landed. See
[`docs/phases/phase-5-polish/00-teammate-test-build-and-release-automation.md`](./docs/phases/phase-5-polish/00-teammate-test-build-and-release-automation.md)
for how releases are cut and what's actually testable right now.

## Basic usage

```
ux-audit init                                # scaffold .ux-audit/, ask about the app
ux-audit scenario add "New User Onboarding"  # scaffold a scenario file, then edit it
ux-audit run                                 # walk the browser through it, write findings
```

1. **`ux-audit init`** — scaffolds `.ux-audit/` in the current project and asks a few
   questions about the app being audited (name, URL, description, core business, target
   users) so findings get tailored to it. Also drops in the default `w3c` accessibility
   guideline (WCAG 2.2 AA via axe-core). Re-run `ux-audit app edit` later to update the
   app overview without repeating the whole flow.
2. **`ux-audit scenario add [name]`** — scaffolds a scenario file at
   `.ux-audit/scenarios/<slug>.md` from a template and tells you to go edit it. A
   scenario is a user journey described in plain language (e.g. "sign up, hit a wrong
   password, then successfully complete the core action"), plus a few structured
   fields at the top of the file:
   - **Auth** — a key into `.ux-audit/credentials.local.json` (gitignored) for
     scenarios that need to be signed in; omit for public pages.
   - **Session** — `fresh` (log out first) or `authenticated` (silent sign-in);
     only relevant alongside `Auth`.
   - **Viewport** — `desktop` (default) or `mobile`.
   - **Output** — where the combined report gets written (single-scenario runs only);
     defaults to `config.json`'s `outputDir`/`UX_AUDIT.md`.

   `ux-audit scenario list` / `ux-audit scenario remove` manage what's on disk.
3. **`ux-audit run`** — runs Playwright + axe-core plus an agentic "drive the browser,
   judge the UX" loop for each scenario, shelling out to an already-authenticated
   `claude` CLI on PATH rather than calling an API directly (that's the one hard
   requirement — get `claude` logged in first). With exactly one scenario on disk it
   runs immediately; with more than one it prompts an interactive checkbox picker
   (or skip the prompt with `--scenario a,b`), running up to `--concurrency` (or
   `config.json`'s `concurrency`) at a time. Each scenario writes its own
   `<slug>-findings.json` under `outputDir`, then all of them are synthesized into one
   combined markdown report — cross-scenario findings deduped and attributed to every
   scenario they showed up in — written to `--output`, or (single-scenario runs) that
   scenario's **Output** field, or `outputDir/UX_AUDIT.md`. `--headed` runs the browser
   visibly instead of headless.

Not implemented yet: `ux-audit guideline` (custom accessibility rule presets beyond the
built-in `w3c`) and the codex/gemini/api backends — see
[`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) for current phase status.

## Where to start

- [`docs/UX_AUDIT_CLI_PLAN.md`](./docs/UX_AUDIT_CLI_PLAN.md) — architecture decisions and rationale.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased execution checklist; check this for current status.
- [`CLAUDE.md`](./CLAUDE.md) — conventions for working in this repo.

## Local setup

```
pnpm install
pnpm typecheck
pnpm dev -- --help
```

`init`/`app`/`scenario`/`run` are implemented (see "Basic usage" above); `guideline` and
the codex/gemini/api backends still throw `not implemented` — that's the intended Phase
3/4 stub state, not a bug. See `IMPLEMENTATION_PLAN.md` for what's done and what's next.

Playwright browser binaries aren't installed by default; run
`pnpm exec playwright install chromium` before any work that actually launches a browser.
