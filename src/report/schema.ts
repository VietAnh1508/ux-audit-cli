import { z } from "zod";
import { FindingSchema } from "../config/schema.js";

export const ReportSectionSchema = z.object({
  scenarioSlug: z.string(),
  findings: z.array(FindingSchema),
});

export const ReportSchema = z.object({
  crossScenarioFindings: z.array(FindingSchema),
  sections: z.array(ReportSectionSchema),
});

export type Report = z.infer<typeof ReportSchema>;
