import type { ChildProcess } from "node:child_process";

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

// Spawns @playwright/mcp as a subprocess pointed at our own browser via --cdp-endpoint,
// with --caps scoped to safe navigation/input capabilities only (no browser_evaluate).
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 3, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function startMcpBridge(_options: McpBridgeOptions): Promise<McpBridge> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

export async function stopMcpBridge(_bridge: McpBridge): Promise<void> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}
