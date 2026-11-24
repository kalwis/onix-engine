import { themaEntriesByCode } from "../generated/thema.js";
import type { ThemaEntry } from "../types/thema.js";

export function getThemaEntry(code: string): ThemaEntry | undefined {
  return themaEntriesByCode.get(code);
}
