import { getThemaEntry } from "./get-thema-entry.js";

export function getThemaHeading(code: string): string | undefined {
  return getThemaEntry(code)?.heading;
}
