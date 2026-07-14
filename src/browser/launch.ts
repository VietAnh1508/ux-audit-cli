import type { Browser, Page } from "playwright";

export interface LaunchedBrowser {
  browser: Browser;
  page: Page;
  cdpEndpoint: string;
}

// Launches Playwright with a remote-debugging port so @playwright/mcp (see mcp-bridge.ts)
// and our own deterministic steps (axe scan, screenshots) share the same live page.
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 2, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function launchBrowser(_viewport: "desktop" | "mobile"): Promise<LaunchedBrowser> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}

// Mirrors the old skill's reachability check before spawning any agent.
export async function checkUrlReachable(_url: string): Promise<boolean> {
  throw new Error("not implemented — see docs/IMPLEMENTATION_PLAN.md Phase 1");
}
