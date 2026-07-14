---
name: ux-audit
description: >
  Produces a structured, ranked UX audit report for a single user scenario,
  covering: user journey friction, visual design (typography, colour, spacing,
  consistency), accessibility (contrast, focus indicators, keyboard navigation,
  ARIA labels), copy quality (labels, error messages, microcopy), interaction
  feedback, and mobile readiness.

  Always invoke this skill when the user asks to audit the UX, review a user
  journey, check usability, assess look and feel, test accessibility, or
  evaluate the design of any screen or flow — even if they don't use the word
  "audit". Invoke for any request involving usability review, design feedback,
  first-time-user experience, or accessibility checks on a running app or
  shared screenshots.
compatibility: >
  Requires Claude Code. Live audits require the Claude in Chrome extension
  installed in Chrome with permissions granted for the app's origin. The app
  under test must be reachable at the specified URL. Static reviews
  (screenshots only) have no browser dependency.
metadata:
  version: 0.1.0-alpha
---

# UX Audit Skill — Orchestrator

This skill orchestrates UX audits. It reads 1 or N scenarios, spawns an executor sub-agent per scenario (running in parallel), collects their findings files, and synthesises the final report.

For static reviews (screenshots only), no sub-agents are used — see Mode C below.

---

## Pre-flight checks

### 1. Browser preflight — extension and URL reachability

Load the Chrome tools needed for preflight via ToolSearch:

```
select:mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_close_mcp
```

Call `tabs_create_mcp` to open a temporary preflight tab. If this call errors, the Chrome extension is unavailable — tell the user to install the Claude in Chrome extension and grant it permissions for the app's origin. Offer a static review (`<skill-dir>/references/static-review.md`) as an alternative. Do not proceed with a live audit until this succeeds.

For each unique scenario URL, call `navigate` to load it in the preflight tab, then call `read_page` to inspect the result. If the page content contains browser network-error markers — `ERR_CONNECTION_REFUSED`, `ERR_NAME_NOT_RESOLVED`, `net::ERR_`, or `This site can't be reached` — the server is not reachable. Stop and tell the user:

> Server not reachable at `<url>`. If this is a local dev server, start it first (try `/run` if you're in Claude Code), then re-run the audit.

Once all URLs pass, close the preflight tab with `tabs_close_mcp`. The executor agents each create their own fresh tabs.

### 2. Confirm with the user

Once the browser preflight passes, ask the user to confirm before proceeding.

Skip this step entirely if **none** of the scenarios have an `Auth:` field — public-facing audits need no sign-in confirmation.

Otherwise ask:

- The credentials in the scenario belong to a **dedicated test account** created solely for this audit — never a personal or production account (the AI will use these credentials to sign in)
- The test account exists and does **not** require a password change on login
- For any `Session: fresh` scenario: you are currently signed out of the app at the scenario's URL (the audit must start from a cold state — if you're logged in, sign out first)

---

## Input: three modes

### Mode A — Scenario file

```
/ux-audit path/to/my-scenario.md
```

Read the file and extract the scenario config. Scenario file format — see `./references/scenario-template.md` (relative to this skill's directory).

### Mode A (multi) — Directory of scenario files

```
/ux-audit path/to/scenarios/
```

Use `find` or `ls` to list all `*.md` files in the directory, excluding any `*-audit.md` files (those are outputs, not inputs). Each file is one scenario — run them all.

### Mode B — Inline description

User describes the scenario in conversation. Extract app URL, credentials, and journey steps. If anything is missing (especially app URL or auth), ask before proceeding. Example:

> "Audit the sign-up flow on http://localhost:3000. It's a task management app for small teams. Use email: test@example.com / password: testpass123. Start from the landing page as a brand-new visitor."

### Mode C — Static review (screenshots only)

Used when the user directly shares screenshots without a running app. Skip the pre-flight checklist and orchestrator steps entirely — read `<skill-dir>/references/static-review.md` and follow those instructions.

---

## Orchestrator steps

### 0. Resolve skill directory

Note the absolute path of the directory containing this SKILL.md file — call it `<skill-dir>`. Use it wherever these instructions reference `<skill-dir>`.

### 1. Collect scenarios

Read every scenario file (Mode A / A-multi) or parse the inline description (Mode B). For each scenario, compute a slug for its findings file:

- Scenario name → lowercase, spaces to hyphens, e.g. `core-loop`
- Findings path: `<skill-dir>/tmp/ux-audit-<slug>-findings.md`

### 2. Spawn executor agents

For each scenario, spawn one Agent with this prompt:

```
Skill directory: <skill-dir>
Read `<skill-dir>/references/executor.md` for your full instructions.

Scenario config:
  App URL: <value>
  App Name: <value>
  App Persona: <value>
  Auth: <value>
  Session: <value>
  Viewport: <value>

Scenario steps:
<paste the scenario steps verbatim>

Write your findings to: <skill-dir>/tmp/ux-audit-<slug>-findings.md
```

**Spawn all agents in the same message** so they run in parallel. Do not wait for one to finish before spawning the next.

### 3. Wait and collect

Once all agents have completed, read each findings file. Check the `Status:` field in each:

- `OK` — proceed
- `ERROR` — Chrome extension was not available for that scenario. Tell the user which scenario failed and offer a static review for it.
- `BLOCKED` — an active session was detected. Tell the user to sign out and re-run that scenario.

### 4. Synthesise and write the report

Read `<skill-dir>/assets/report-single.md` for a single scenario, or `<skill-dir>/assets/report-multi.md` for multiple scenarios. Fill in `{date}` with today's date (YYYY-MM-DD format).

**Single scenario:** Format the findings file into the template. Output path:
- Use the `Output:` field from the scenario file if present
- Otherwise write to `<scenario-directory>/<scenario-basename>-audit.md`
- Otherwise write to `UX_AUDIT.md` in the current working directory

**Multiple scenarios:** Use the multi-scenario template section. Identify cross-scenario findings — issues where the same element and dimension appear in 2 or more scenarios' findings. List those first in a "Cross-scenario findings" section, then include each scenario's remaining findings underneath. Output path defaults to `UX_AUDIT.md`; honour an `Output:` field on the first scenario file if present.

When writing the report:
- Every finding must name an **exact UI element** with a **concrete suggestion**.
- Skip dimensions that are fine — do not pad with neutral observations.
- Cross-scenario deduplication: if the same issue appears in multiple scenarios, list it once in the cross-scenario section and reference it by name in each scenario's section.
- Prioritise issues on the **critical path** (sign in → core action → confirmation).
- Do not include screenshots in the report file — text only.
