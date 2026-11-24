import { themaEntries } from "../generated/thema.js";
import type { ThemaEntry } from "../types/thema.js";

export function getThemaEntries(): readonly ThemaEntry[] {
  return themaEntries;
}
