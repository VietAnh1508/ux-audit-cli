# ux-audit

An automated UX auditor that navigates your app like a first-time user. Give it a scenario — a URL, a persona, and a journey to walk — and it opens a real browser, moves through each step, captures screenshots at key states, and produces a structured findings report with specific, actionable issues.

Works for any web app: authenticated flows, onboarding, checkout, settings, anything with a user journey worth testing.

## What this is (and isn't)

`ux-audit` is a **design review tool**, not a test suite. It does not assert correctness, check for regressions, or verify that your app behaves as specified. It won't replace end-to-end, integration, or UI tests — those tell you whether your app *works*; this tells you whether it *feels right to use*.

The audit walks a user journey through a real browser, evaluates each screen against UX and UI principles, and surfaces friction, clarity issues, and interaction problems that automated tests typically miss: confusing labels, awkward flows, weak visual hierarchy, missing feedback, and similar experience gaps.

Use it when you want a critical eye on a flow from the user's perspective, not when you need to verify functional correctness.

---

## Quick start

**Single scenario file:**

```
/ux-audit path/to/my-scenario.md
```

**All scenarios in a directory (runs in parallel):**

```
/ux-audit path/to/scenarios/
```

**Inline — describe the scenario in your message:**

```
/ux-audit  ← then describe what to test
```

**Static review — share screenshots directly:**

```
/ux-audit  ← then attach screenshots
```

## How it works

Two layers run under the hood:

1. **Orchestrator** — reads 1 or N scenarios, spawns one executor sub-agent per scenario in parallel, waits for all to finish, then synthesises the final report.
2. **Executor** — each executor handles one scenario: loads browser tools, walks the journey, evaluates each screen, and writes a structured findings file.

For multiple scenarios the orchestrator deduplicates cross-scenario findings and writes one combined report.

## Creating a scenario file

1. Copy `~/.claude/skills/ux-audit/references/scenario-template.md` into your project (e.g. `.claude/ux-audit/my-scenario.md`)
2. Fill in the app URL, credentials, and journey steps
3. Run `/ux-audit .claude/ux-audit/my-scenario.md`

Keep scenario files in your project — they describe app-specific flows.

## Scenario file fields

| Field         | Required | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `App URL`     | Yes      | Base URL of the running app                      |
| `App Name`    | Yes      | Short name used in the report title              |
| `App Persona` | Yes      | One sentence describing the app and its users    |
| `Auth`        | No       | `email: x / password: y` — omit for public pages |
| `Session`     | No       | `fresh` (default) or `authenticated`             |
| `Viewport`    | No       | `desktop` (default) or `mobile` (390px)          |
| `Output`      | No       | Report path — defaults to `UX_AUDIT.md`          |

## Requirements

- App server running at the specified URL
- [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude-in-chrome/aaocglkjkiohbbkgdibmeenknfghiobf) installed with permissions for the app's origin
- Test account that doesn't require a password change on first login
