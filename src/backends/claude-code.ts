import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import type { LlmBackend, LlmBackendRunOptions } from "./types.js";
import type { AppOverview, Credentials } from "../types/index.js";

const execFileAsync = promisify(execFile);

interface ClaudeAuthStatus {
  loggedIn: boolean;
}

// Must match the mcpServers key src/browser/mcp-bridge.ts writes into mcp-config.json.
const PLAYWRIGHT_MCP_SERVER_NAME = "playwright";

// UI-interaction and read-only inspection tools needed to walk a scenario and judge UX.
// Deliberately narrower than "everything except the RCE tools" the phase doc originally
// called for — confirmed via a live smoke test (docs/phases/phase-1-single-scenario.md)
// that the full @playwright/mcp 0.0.78 tool set also includes tools this allowlist omits
// on purpose:
//   - browser_evaluate, browser_run_code_unsafe: arbitrary code execution (RCE)
//   - browser_tabs, browser_close, browser_resize: tab/browser lifecycle and viewport are
//     owned by src/browser/launch.ts + the engine, not the agent — the agent touching these
//     would also break the shared-live-page invariant axe-runner.ts depends on afterward
//   - browser_cookie_*, browser_*storage_*, browser_set_storage_state, browser_storage_state,
//     browser_route*, browser_unroute, browser_network_state_set: state/network mocking would
//     let the agent fake auth/session state instead of exercising the real flow under audit
//   - browser_annotate, browser_*highlight, browser_resume, browser_*_tracing, browser_*_video,
//     browser_get_config: presentation/tracing aids with no findings value
const PLAYWRIGHT_TOOL_NAMES = [
  "browser_navigate",
  "browser_navigate_back",
  "browser_click",
  "browser_type",
  "browser_press_key",
  "browser_hover",
  "browser_select_option",
  "browser_drag",
  "browser_drop",
  "browser_fill_form",
  "browser_file_upload",
  "browser_handle_dialog",
  "browser_wait_for",
  "browser_snapshot",
  "browser_take_screenshot",
  "browser_find",
  "browser_console_messages",
  "browser_network_requests",
  "browser_network_request",
];

// Findings handoff is file-based (see docs/UX_AUDIT_CLI_PLAN.md Execution engine step 6), so
// the agent needs a way to write its own output — Write is the only non-browser tool allowed.
const ALLOWED_TOOLS = [
  ...PLAYWRIGHT_TOOL_NAMES.map((tool) => `mcp__${PLAYWRIGHT_MCP_SERVER_NAME}__${tool}`),
  "Write",
];

// No --max-turns (or equivalent) flag exists in the installed claude CLI — drift from the
// "iteration/turn cap" mitigation docs/UX_AUDIT_CLI_PLAN.md Open risks assumed. A wall-clock
// subprocess timeout is the runaway guard instead.
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

const SCOPE_GUARDRAIL =
  "Stay tightly scoped to the scenario steps you're given: act on one step at a time, " +
  "take a snapshot or screenshot to confirm the resulting state before moving to the next " +
  "step, and never explore the app beyond what the steps ask for.";

function formatCredentials(credentials?: Credentials): string {
  if (!credentials) return "";
  return `**Login credentials:** email: ${credentials.email} / password: ${credentials.password}\n`;
}

function sessionInstructions(session: "fresh" | "authenticated", credentials?: Credentials): string {
  if (!credentials) {
    return "This scenario is public-facing — no sign-in is required. Navigate directly to the App URL and begin.";
  }
  if (session === "fresh") {
    return (
      "This scenario tests auth/onboarding from a cold start. Navigate to the App URL and take " +
      "a screenshot. If the app redirects to a sign-in page, proceed with the steps below. If it " +
      'instead lands on an already-authenticated page, stop and write a findings file with ' +
      '"status": "BLOCKED" and a note that an active session was detected — the audit needs a ' +
      "clean state."
    );
  }
  return (
    "This scenario starts mid-app; sign-in is a prerequisite, not the subject. Navigate to the " +
    "App URL. If redirected to a sign-in page, sign in with the credentials above without " +
    "screenshotting or reporting that step, then proceed to the steps below."
  );
}

function buildPrompt(options: LlmBackendRunOptions): string {
  const { scenario, appOverview, credentials, findingsOutputPath } = options;

  return `You are a UX designer conducting a structured usability assessment. Walk through the scenario below as a first-time user would: notice what's confusing, what looks unpolished, what slows them down. Your findings should reflect genuine design judgment, not a checklist pass.

A browser is open and controllable through the connected browser tools — navigate to the App URL below to begin. Accessibility scanning (axe-core) runs separately outside this session — focus on subjective UX judgment: visual hierarchy, CTA clarity, copy quality, empty/loading states, feedback after actions, information density, friction, and anything a first-time user would find confusing. Take a screenshot at each key state (initial load, after each interaction, error states, confirmation states) and note the screen name/state as you go.

Do not:
- trigger alert()/confirm()/prompt() dialogs — they block the browser
- navigate outside the app's origin
- reload the page, close the tab, or open new tabs

## App

**Name:** ${appOverview.name}
**Description:** ${appOverview.description}
**Core business:** ${appOverview.coreBusiness}
**Target users:** ${appOverview.targetUsers}

## Scenario

**App URL:** ${scenario.appUrl}
**App name:** ${scenario.appName}
**Persona to role-play:** ${scenario.appPersona}
**Session:** ${scenario.session}
${formatCredentials(credentials)}${scenario.selectorHint ? `**Selector hint:** ${scenario.selectorHint}\n` : ""}
${sessionInstructions(scenario.session, credentials)}

### Steps

${scenario.steps}

## Writing findings

When you're done walking the scenario, use the Write tool to save your findings as JSON to exactly this path: ${findingsOutputPath}

Write ONLY the JSON object, matching this shape exactly:

\`\`\`json
{
  "scenarioSlug": "${scenario.slug}",
  "status": "OK",
  "findings": [
    {
      "element": "exact UI element name, e.g. 'Submit button'",
      "dimension": "e.g. 'CTA clarity', 'Visual hierarchy', 'Copy quality', 'Feedback'",
      "severity": "high | medium | low",
      "observation": "what a real user would notice, in plain language",
      "suggestion": "a concrete fix"
    }
  ],
  "notes": "optional free-text notes, omit the field entirely if you have none"
}
\`\`\`

- "status" is "OK" if you completed the scenario, "BLOCKED" if you could not proceed (e.g. an active session where the scenario needed a fresh one), or "ERROR" if something in your own tooling failed.
- Every finding must name an exact UI element and a concrete suggestion — "the button is confusing" is not a finding.
- Skip dimensions that are fine; do not pad with neutral observations.
- Deduplicate: if an issue appears on multiple screens, list it once.
- Prioritize issues on the critical path over edge cases.
`;
}

// v1 default backend — see docs/IMPLEMENTATION_PLAN.md Phase 1.
// Spawns `claude -p` non-interactively with --mcp-config pointing at @playwright/mcp
// (see src/browser/mcp-bridge.ts) and --allowedTools scoped to that server only.
export class ClaudeCodeBackend implements LlmBackend {
  readonly name = "claude-code";

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("claude", ["auth", "status", "--json"], {
        timeout: 10_000,
      });
      const status = JSON.parse(stdout) as ClaudeAuthStatus;
      return status.loggedIn === true;
    } catch {
      // Covers both "claude" missing from PATH (ENOENT) and "not logged in" —
      // either way this backend isn't usable, so collapse both to false.
      return false;
    }
  }

  async runScenario(options: LlmBackendRunOptions): Promise<void> {
    const prompt = buildPrompt(options);

    // Single-shot: validate-and-retry on malformed findings is the engine's job
    // (src/engine/findings-handoff.ts), not this adapter's.
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "claude",
        [
          "-p",
          "--mcp-config",
          options.mcpServerConfigPath,
          // Without this, the subprocess also picks up the user's global/project MCP
          // servers (e.g. claude-in-chrome, context7) — keep it scoped to our own bridge.
          "--strict-mcp-config",
          // The audited app is a real repo the CLI runs against — without this, `claude -p`
          // auto-discovers *that* repo's CLAUDE.md/hooks/settings.json (confirmed via a
          // marker-file smoke test: a CLAUDE.md instruction leaked into the response even
          // from a subdirectory, i.e. discovery walks up from cwd). Empty string disables
          // project + local + user setting sources entirely — verified this also silences
          // a project-level hook, not just CLAUDE.md.
          "--setting-sources",
          "",
          "--allowedTools",
          ALLOWED_TOOLS.join(","),
          "--append-system-prompt",
          SCOPE_GUARDRAIL,
        ],
        {
          // stdout is intentionally unconsumed below (findings go to a file, not stdout) —
          // "ignore" it rather than "pipe" so an unbounded final message can't fill the OS
          // pipe buffer and deadlock the child mid-write (close would then never fire, and
          // RUN_TIMEOUT_MS would misreport a real hang as "timed out").
          stdio: ["pipe", "ignore", "pipe"],
          timeout: RUN_TIMEOUT_MS,
          // --setting-sources "" above is the real guard against the audited repo's own
          // CLAUDE.md/hooks. This cwd is only extra insurance, so it must be a directory
          // that's actually outside that repo — NOT derived from mcpServerConfigPath/
          // userDataDir, which by convention (src/config/paths.ts) lives under the audited
          // repo's own .ux-audit/ and would be just as contaminated (discovery walks up).
          cwd: tmpdir(),
        },
      );

      let stderr = "";
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });
      proc.once("error", reject);
      proc.once("close", (code, signal) => {
        if (signal) {
          reject(
            new Error(`claude -p was killed with ${signal} (likely timed out after ${RUN_TIMEOUT_MS}ms)\n${stderr}`),
          );
          return;
        }
        if (code !== 0) {
          reject(new Error(`claude -p exited with code ${code}\n${stderr}`));
          return;
        }
        resolve();
      });

      // Via stdin, not argv — the prompt may embed real login credentials, and argv is
      // visible to every other process on the machine via `ps`.
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  async synthesizeReport(_findingsPaths: string[], _appOverview: AppOverview): Promise<unknown> {
    throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 2");
  }
}
