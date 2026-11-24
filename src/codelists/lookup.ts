import {
  codelists,
  codelistsByNumber,
  codelistEntriesByCode,
} from "../generated/codelists.js";
import type { Codelist, CodelistEntry } from "../types/codelist.js";

export function getList(number: number): Codelist | undefined {
  return codelistsByNumber.get(number);
}

export function getCode(
  number: number,
  code: string,
): CodelistEntry | undefined {
  return codelistEntriesByCode.get(number)?.get(code);
}

export interface CodeSearchResult {
  readonly listNumber: number;
  readonly listHeading: string;
  readonly entry: CodelistEntry;
}

export function searchCodes(
  query: string,
  options: {
    readonly list?: number;
    readonly includeDeprecated?: boolean;
  } = {},
): readonly CodeSearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const lists =
    options.list === undefined
      ? codelists
      : [getList(options.list)].filter((list): list is Codelist => !!list);
  return lists.flatMap((list) =>
    list.entries
      .filter(
        (entry) =>
          (options.includeDeprecated !== false || !entry.issueDeprecated) &&
          [entry.code, entry.heading, entry.note ?? ""].some((value) =>
            value.toLocaleLowerCase().includes(needle),
          ),
      )
      .map((entry) => ({
        listNumber: list.number,
        listHeading: list.heading,
        entry,
      })),
  );
}

export type { Codelist, CodelistEntry } from "../types/codelist.js";
