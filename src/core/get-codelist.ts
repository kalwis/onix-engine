import { codelistsByNumber } from "../generated/codelists.js";
import type { Codelist } from "../types/codelist.js";

export function getCodelist(number: number): Codelist | undefined {
  return codelistsByNumber.get(number);
}
