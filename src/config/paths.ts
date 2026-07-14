import path from "node:path";

export const UX_AUDIT_DIR = ".ux-audit";

export function resolveUxAuditDir(cwd: string = process.cwd()): string {
  return path.join(cwd, UX_AUDIT_DIR);
}

export function resolveConfigPath(cwd: string = process.cwd()): string {
  return path.join(resolveUxAuditDir(cwd), "config.json");
}

export function resolveAppOverviewPath(cwd: string = process.cwd()): string {
  return path.join(resolveUxAuditDir(cwd), "app.json");
}

export function resolveScenariosDir(cwd: string = process.cwd()): string {
  return path.join(resolveUxAuditDir(cwd), "scenarios");
}

export function resolveCredentialsPath(cwd: string = process.cwd()): string {
  return path.join(resolveUxAuditDir(cwd), "credentials.local.json");
}

export function resolveGuidelinesDir(cwd: string = process.cwd()): string {
  return path.join(resolveUxAuditDir(cwd), "guidelines");
}
