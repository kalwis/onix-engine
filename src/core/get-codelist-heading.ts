import { getCodelistEntry } from "./get-codelist-entry.js";

export function getCodelistHeading(
  number: number,
  code: string,
): string | undefined {
  return getCodelistEntry(number, code)?.heading;
}
