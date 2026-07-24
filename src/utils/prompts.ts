import { cancel, isCancel } from "@clack/prompts";

export function exitOnCancel<T>(value: T | symbol, message = "Cancelled."): T {
  if (isCancel(value)) {
    cancel(message);
    process.exit(1);
  }
  return value;
}
