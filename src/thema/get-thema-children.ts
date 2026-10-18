import { themaEntriesByParent } from "../generated/thema.js";
import type { ThemaEntry } from "../types/thema.js";

export function getThemaChildren(parentCode?: string): readonly ThemaEntry[] {
  return themaEntriesByParent.get(parentCode) ?? [];
}
