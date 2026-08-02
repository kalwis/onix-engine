import { getCodelistEntry } from "./get-codelist-entry.js";

export function hasCodelistCode(number: number, code: string): boolean {
  return getCodelistEntry(number, code) !== undefined;
}
