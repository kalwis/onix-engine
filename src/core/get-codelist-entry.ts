import { codelistEntriesByCode } from "../generated/codelists.js";
import type { CodelistEntry } from "../types/codelist.js";

export function getCodelistEntry(
  number: number,
  code: string,
): CodelistEntry | undefined {
  return codelistEntriesByCode.get(number)?.get(code);
}
