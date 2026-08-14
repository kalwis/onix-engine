import { getThemaEntry } from "./get-thema-entry.js";

export function hasThemaCode(code: string): boolean {
  return getThemaEntry(code) !== undefined;
}
