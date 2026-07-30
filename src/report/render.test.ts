import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render.js";
import type { Report } from "./schema.js";

function baseReport(overrides: Partial<Report> = {}): Report {
  return {
    appName: "Acme",
    executiveSummary: "Overall the flow works but the CTA is hard to see.",
    crossScenarioFindings: [],
    sections: [
      {
        scenarioSlug: "login",
        status: "OK",
        findings: [
          {
            element: "Sign in button",
            dimension: "CTA clarity",
            severity: "medium",
            observation: "Grey button blends into the background.",
            suggestion: "Use a high-contrast brand color.",
          },
        ],
        screens: [],
      },
    ],
    quickWins: [],
    featureSuggestions: [],
    ...overrides,
  };
}

describe("renderMarkdown single mode", () => {
  it("renders the app name, scenario slug, and executive summary", () => {
    const markdown = renderMarkdown(baseReport(), "single");

    expect(markdown).toContain("# UX Audit — Acme: login");
    expect(markdown).toContain("Overall the flow works but the CTA is hard to see.");
  });

  it("groups findings under the correct severity heading and only headings with findings appear", () => {
    const report = baseReport({
      sections: [
        {
          scenarioSlug: "login",
          status: "OK",
          findings: [
            { element: "A", dimension: "Copy", severity: "high", observation: "obs A", suggestion: "fix A" },
            { element: "B", dimension: "Copy", severity: "low", observation: "obs B", suggestion: "fix B" },
          ],
          screens: [],
        },
      ],
    });

    const markdown = renderMarkdown(report, "single");

    expect(markdown).toContain("🔴 High impact");
    expect(markdown).toContain("🟢 Low impact / Nice to have");
    expect(markdown).not.toContain("🟡 Medium impact");
    expect(markdown.indexOf("🔴 High impact")).toBeLessThan(markdown.indexOf("🟢 Low impact"));
    expect(markdown).toContain("**A** `Copy` — obs A");
    expect(markdown).toContain("Suggestion: fix A");
  });

  it("renders screen notes including optional state", () => {
    const report = baseReport({
      sections: [
        {
          scenarioSlug: "login",
          status: "OK",
          findings: [],
          screens: [
            { name: "Login", state: "initial load", observations: "Clean layout." },
            { name: "Dashboard", observations: "No state given." },
          ],
        },
      ],
    });

    const markdown = renderMarkdown(report, "single");

    expect(markdown).toContain("## Screen-by-screen notes");
    expect(markdown).toContain("### Screen 1: Login");
    expect(markdown).toContain("_State: initial load_");
    expect(markdown).toContain("### Screen 2: Dashboard");
    expect(markdown).toContain("Observations: No state given.");
  });

  it("omits the screen notes, quick wins, and feature suggestions sections when empty", () => {
    const markdown = renderMarkdown(baseReport(), "single");

    expect(markdown).not.toContain("Screen-by-screen notes");
    expect(markdown).not.toContain("Quick wins");
    expect(markdown).not.toContain("Feature suggestions");
    expect(markdown).not.toContain("[]");
  });

  it("renders quick wins and feature suggestions as checklists when present", () => {
    const markdown = renderMarkdown(
      baseReport({ quickWins: ["Fix contrast"], featureSuggestions: ["Add password strength meter"] }),
      "single",
    );

    expect(markdown).toContain("## Quick wins\n\n- [ ] Fix contrast");
    expect(markdown).toContain("## Feature suggestions\n\n- [ ] Add password strength meter");
  });

  it("surfaces a status note for a non-OK section", () => {
    const markdown = renderMarkdown(
      baseReport({
        sections: [
          {
            scenarioSlug: "checkout-mobile",
            status: "BLOCKED",
            findings: [],
            screens: [],
            notes: "Landed on an already-authenticated dashboard.",
          },
        ],
      }),
      "single",
    );

    expect(markdown).toContain("**Status: BLOCKED**");
    expect(markdown).toContain("Landed on an already-authenticated dashboard.");
    expect(markdown).toContain("No findings recorded.");
  });
});

describe("renderMarkdown multi mode", () => {
  function multiReport(): Report {
    return {
      appName: "Acme",
      executiveSummary: "Consistent friction around CTAs across scenarios.",
      crossScenarioFindings: [
        {
          element: "Primary CTA",
          dimension: "CTA clarity",
          severity: "medium",
          observation: "Low-contrast button appears in both flows.",
          suggestion: "Use a consistent high-contrast brand color.",
          appearsIn: ["login", "checkout"],
        },
      ],
      sections: [
        { scenarioSlug: "login", status: "OK", findings: [], screens: [] },
        { scenarioSlug: "checkout", status: "OK", findings: [], screens: [] },
        {
          scenarioSlug: "checkout-mobile",
          status: "BLOCKED",
          findings: [],
          screens: [],
          notes: "Could not start from a fresh session.",
        },
      ],
      quickWins: ["Fix CTA contrast"],
      featureSuggestions: [],
    };
  }

  it("renders the scenario count, slugs, and cross-scenario findings with appearsIn", () => {
    const markdown = renderMarkdown(multiReport(), "multi");

    expect(markdown).toContain("# UX Audit — Acme: 3 Scenarios");
    expect(markdown).toContain("_Scenarios: login, checkout, checkout-mobile._");
    expect(markdown).toContain("## Cross-scenario findings");
    expect(markdown).toContain("appears in: login, checkout");
  });

  it("renders one subsection per scenario with a status note for non-OK sections", () => {
    const markdown = renderMarkdown(multiReport(), "multi");

    expect(markdown).toContain("## Scenario: login");
    expect(markdown).toContain("## Scenario: checkout");
    expect(markdown).toContain("## Scenario: checkout-mobile");
    expect(markdown).toContain("**Status: BLOCKED**");
    expect(markdown).toContain("Could not start from a fresh session.");
  });

  it("renders combined quick wins and omits combined feature suggestions when empty", () => {
    const markdown = renderMarkdown(multiReport(), "multi");

    expect(markdown).toContain("## Combined quick wins\n\n- [ ] Fix CTA contrast");
    expect(markdown).not.toContain("Combined feature suggestions");
  });

  it("says no cross-scenario issues when the list is empty", () => {
    const report = multiReport();
    report.crossScenarioFindings = [];

    const markdown = renderMarkdown(report, "multi");

    expect(markdown).toContain("No issues appeared in more than one scenario.");
  });
});
