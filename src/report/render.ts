import type { Finding, ScreenNote } from "../types/index.js";
import type { Report } from "./schema.js";

type ReportSection = Report["sections"][number];
type CrossScenarioFinding = Report["crossScenarioFindings"][number];

const SEVERITY_HEADINGS: Record<Finding["severity"], string> = {
  high: "🔴 High impact",
  medium: "🟡 Medium impact",
  low: "🟢 Low impact",
};

const SEVERITY_ORDER: Finding["severity"][] = ["high", "medium", "low"];

function renderFinding(finding: Finding): string {
  return `**${finding.element}** \`${finding.dimension}\` — ${finding.observation}\nSuggestion: ${finding.suggestion}`;
}

function renderCrossScenarioFinding(finding: CrossScenarioFinding): string {
  return `**${finding.element}** \`${finding.dimension}\` — appears in: ${finding.appearsIn.join(", ")}. ${finding.observation}\nSuggestion: ${finding.suggestion}`;
}

// severity order + heading text vary slightly by mode (single mode's "low" heading also
// says "/ Nice to have", per templates/report-single.md vs templates/report-multi.md).
function renderFindingsBySeverity(findings: Finding[], headingLevel: string, lowHeading: string): string {
  if (findings.length === 0) {
    return "No findings recorded.";
  }

  const bySeverity: Record<Finding["severity"], Finding[]> = { high: [], medium: [], low: [] };
  for (const finding of findings) {
    bySeverity[finding.severity].push(finding);
  }

  return SEVERITY_ORDER.filter((severity) => bySeverity[severity].length > 0)
    .map((severity) => {
      const heading = severity === "low" ? lowHeading : SEVERITY_HEADINGS[severity];
      return `${headingLevel} ${heading}\n\n${bySeverity[severity].map(renderFinding).join("\n\n")}`;
    })
    .join("\n\n");
}

function renderScreenNote(screen: ScreenNote, index: number, headingLevel: string): string {
  const lines = [`${headingLevel} Screen ${index + 1}: ${screen.name}`];
  if (screen.state) {
    lines.push(`_State: ${screen.state}_`);
  }
  lines.push(`Observations: ${screen.observations}`);
  return lines.join("\n\n");
}

function renderScreenNotes(screens: ScreenNote[], headingLevel: string): string | undefined {
  if (screens.length === 0) {
    return undefined;
  }
  return screens.map((screen, index) => renderScreenNote(screen, index, headingLevel)).join("\n\n");
}

function renderChecklist(items: string[]): string {
  return items.map((item) => `- [ ] ${item}`).join("\n");
}

function renderStatusNote(section: ReportSection): string | undefined {
  if (section.status === "OK") {
    return undefined;
  }
  const suffix = section.notes ? ` — ${section.notes}` : "";
  return `> **Status: ${section.status}**${suffix}`;
}

function renderSingle(report: Report): string {
  const section = report.sections[0];
  if (!section) {
    throw new Error("renderMarkdown: single mode requires exactly one report section");
  }

  const parts = [
    `# UX Audit — ${report.appName}: ${section.scenarioSlug}`,
    `## Executive Summary\n\n${report.executiveSummary}`,
  ];

  const statusNote = renderStatusNote(section);
  if (statusNote) {
    parts.push(statusNote);
  }

  parts.push(`## Findings\n\n${renderFindingsBySeverity(section.findings, "###", "🟢 Low impact / Nice to have")}`);

  const screenNotes = renderScreenNotes(section.screens, "###");
  if (screenNotes) {
    parts.push(`## Screen-by-screen notes\n\n${screenNotes}`);
  }

  if (report.quickWins.length > 0) {
    parts.push(`## Quick wins\n\n${renderChecklist(report.quickWins)}`);
  }

  if (report.featureSuggestions.length > 0) {
    parts.push(`## Feature suggestions\n\n${renderChecklist(report.featureSuggestions)}`);
  }

  return parts.join("\n\n---\n\n");
}

function renderScenarioSection(section: ReportSection): string {
  const parts = [`## Scenario: ${section.scenarioSlug}`];

  const statusNote = renderStatusNote(section);
  if (statusNote) {
    parts.push(statusNote);
  }

  parts.push(renderFindingsBySeverity(section.findings, "###", SEVERITY_HEADINGS.low));

  const screenNotes = renderScreenNotes(section.screens, "#####");
  if (screenNotes) {
    parts.push(`#### Screen notes\n\n${screenNotes}`);
  }

  return parts.join("\n\n");
}

function renderMulti(report: Report): string {
  const scenarioSlugs = report.sections.map((section) => section.scenarioSlug);
  const parts = [
    `# UX Audit — ${report.appName}: ${report.sections.length} Scenarios`,
    `_Scenarios: ${scenarioSlugs.join(", ")}._`,
    `## Executive Summary\n\n${report.executiveSummary}`,
    `## Cross-scenario findings\n\n${
      report.crossScenarioFindings.length > 0
        ? report.crossScenarioFindings.map(renderCrossScenarioFinding).join("\n\n")
        : "No issues appeared in more than one scenario."
    }`,
  ];

  for (const section of report.sections) {
    parts.push(renderScenarioSection(section));
  }

  if (report.quickWins.length > 0) {
    parts.push(`## Combined quick wins\n\n${renderChecklist(report.quickWins)}`);
  }

  if (report.featureSuggestions.length > 0) {
    parts.push(`## Combined feature suggestions\n\n${renderChecklist(report.featureSuggestions)}`);
  }

  return parts.join("\n\n---\n\n");
}

export function renderMarkdown(report: Report, mode: "single" | "multi"): string {
  return mode === "single" ? renderSingle(report) : renderMulti(report);
}
