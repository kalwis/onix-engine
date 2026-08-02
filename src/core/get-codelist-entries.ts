import { getCodelist } from "./get-codelist.js";
import type { CodelistEntry } from "../types/codelist.js";

export function getCodelistEntries(number: number): readonly CodelistEntry[] {
  return getCodelist(number)?.entries ?? [];
}
