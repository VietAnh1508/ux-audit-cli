import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

export interface LaunchedBrowser {
  browser: Browser;
  page: Page;
  cdpEndpoint: string;
}

const VIEWPORT_SIZES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

const URL_REACHABLE_TIMEOUT_MS = 5000;

// Exported for mcp-bridge.ts, which needs its own free port for @playwright/mcp's
// --port (HTTP transport), independent of the browser's own CDP port above.
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("failed to acquire a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

// Launches Playwright with a remote-debugging port so @playwright/mcp (see mcp-bridge.ts)
// and our own deterministic steps (axe scan, screenshots) share the same live page.
// See docs/UX_AUDIT_CLI_PLAN.md Execution engine step 2, docs/IMPLEMENTATION_PLAN.md Phase 1.
export async function launchBrowser(
  viewport: "desktop" | "mobile",
  options: { headless?: boolean } = {},
): Promise<LaunchedBrowser> {
  const port = await getFreePort();
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [`--remote-debugging-port=${port}`],
  });
  const context = await browser.newContext({ viewport: VIEWPORT_SIZES[viewport] });
  const page = await context.newPage();
  return { browser, page, cdpEndpoint: `http://127.0.0.1:${port}` };
}

// Mirrors the old skill's reachability check before spawning any agent.
export async function checkUrlReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_REACHABLE_TIMEOUT_MS);
  try {
    await fetch(url, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
