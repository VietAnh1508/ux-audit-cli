import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { getFreePort } from "./launch.js";

export interface McpBridgeOptions {
  cdpEndpoint: string;
  /** Distinct per concurrent scenario — persistent profiles can't be shared across clients. */
  userDataDir: string;
}

export interface McpBridge {
  process: ChildProcess;
  /** Path to write as --mcp-config for the LLM backend. */
  mcpConfigPath: string;
}

const READY_TIMEOUT_MS = 15_000;

function resolveCliPath(): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@playwright/mcp/package.json");
  return path.join(path.dirname(packageJsonPath), "cli.js");
}

function waitForReady(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;

    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      proc.stdout?.off("data", onOutput);
      proc.stderr?.off("data", onOutput);
      resolve();
    };
    // @playwright/mcp logs its "Listening on" readiness line to stderr, not stdout.
    const onOutput = (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      output += text;
      if (text.includes("Listening on")) onReady();
    };
    proc.stdout?.on("data", onOutput);
    proc.stderr?.on("data", onOutput);

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`timed out waiting for @playwright/mcp to start\n${output}`));
    }, READY_TIMEOUT_MS);

    proc.once("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
    proc.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`@playwright/mcp exited early with code ${code}\n${output}`));
    });
  });
}

// Spawns @playwright/mcp as a subprocess pointed at our own browser via --cdp-endpoint,
// running as an HTTP server so both this process and the LLM backend subprocess can
// reach it independently. No --caps flag: in the installed version, the tools that
// execute arbitrary JS (browser_evaluate, browser_run_code_unsafe) are always-on core
// tools, not an opt-in capability — excluding them is the backend's job, via
// --allowedTools (see src/backends/claude-code.ts), not this server's.
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 3, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function startMcpBridge(options: McpBridgeOptions): Promise<McpBridge> {
  const port = await getFreePort();
  const cliPath = resolveCliPath();

  const proc = spawn(
    process.execPath,
    [
      cliPath,
      "--port",
      String(port),
      "--cdp-endpoint",
      options.cdpEndpoint,
      // No-op today: connecting via --cdp-endpoint attaches to an already-launched
      // browser, so there's no profile for this flag to isolate. Passed through anyway
      // to match the documented per-scenario contract in case that changes upstream.
      "--user-data-dir",
      options.userDataDir,
      // Without this, @playwright/mcp writes screenshots/etc. relative to its own cwd —
      // which is the audited app's repo, not somewhere we own. Keep its artifacts contained.
      "--output-dir",
      path.join(options.userDataDir, "output"),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  await waitForReady(proc);

  await mkdir(options.userDataDir, { recursive: true });
  const mcpConfigPath = path.join(options.userDataDir, "mcp-config.json");
  await writeFile(
    mcpConfigPath,
    JSON.stringify(
      { mcpServers: { playwright: { type: "http", url: `http://localhost:${port}/mcp` } } },
      null,
      2,
    ),
    "utf-8",
  );

  return { process: proc, mcpConfigPath };
}

export async function stopMcpBridge(bridge: McpBridge): Promise<void> {
  if (bridge.process.exitCode !== null || bridge.process.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    bridge.process.once("exit", () => resolve());
    bridge.process.kill();
  });
}
