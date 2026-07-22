import type { AppOverview } from "../types/index.js";

function validateRequired(input: string): string | undefined {
  return input.trim() ? undefined : "Required";
}

function validateUrl(input: string): string | undefined {
  const required = validateRequired(input);
  if (required) return required;
  try {
    new URL(input.trim());
    return undefined;
  } catch {
    return "Must be a valid URL, e.g. http://localhost:3000";
  }
}

export const APP_OVERVIEW_FIELDS: Array<{
  key: keyof AppOverview;
  message: string;
  validate: (input: string) => string | undefined;
}> = [
  { key: "name", message: "App name", validate: validateRequired },
  {
    key: "url",
    message: "App URL (default starting point for scenarios, e.g. http://localhost:3000)",
    validate: validateUrl,
  },
  { key: "description", message: "One-paragraph description of what the app does", validate: validateRequired },
  {
    key: "coreBusiness",
    message: "Core business model (e.g. subscription, ad-supported, marketplace)",
    validate: validateRequired,
  },
  { key: "targetUsers", message: "Target user segments (who this app is for)", validate: validateRequired },
];
