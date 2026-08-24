/**
 * Reviewed against the pinned Thema v1.6 notes. This is deliberately
 * hand-maintained: changes require an explicit review of those notes and must
 * not be inferred from source prose at runtime or during data generation.
 */
export const themaNonAssignableCodes = Object.freeze([
  "1",
  "1Q",
  "2",
  "3",
  "4",
  "5",
  "5A",
  "5T",
  "5Y",
  "6",
  "C",
  "D",
  "F",
  "FY",
  "G",
  "L",
  "N",
  "P",
  "Q",
  "R",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "YFZ",
  "6A",
  "6B",
  "6C",
  "6D",
  "6E",
  "6F",
  "6G",
  "6H",
  "6J",
  "6K",
  "6L",
  "6M",
  "6N",
  "6P",
  "6Q",
  "6R",
  "6S",
  "6SX",
  "6T",
  "6U",
  "6V",
  "6W",
  "6X",
] as const);

const nonAssignableThemaCodes = new Set<string>(themaNonAssignableCodes);

export function isThemaCodeAssignable(code: string): boolean {
  return themaEntriesByCode.has(code) && !nonAssignableThemaCodes.has(code);
}
import { themaEntriesByCode } from "../generated/thema.js";
