/** Build-time importer for official EDItEUR ONIX codelist JSON files. */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type SourceEntry = {
  readonly code: string;
  readonly heading: string;
  readonly note?: string;
  readonly issueAdded?: string;
  readonly issueModified?: string;
  readonly issueDeprecated?: string;
};
type SourceCodelist = {
  readonly number: number;
  readonly heading: string;
  readonly entries: readonly SourceEntry[];
};
type SourceThemaEntry = {
  readonly code: string;
  readonly heading: string;
  readonly parentCode?: string;
  readonly note?: string;
};

const root = resolve(import.meta.dirname, "..");
const rawDirectory = resolve(root, "data/raw");
const generatedDirectory = resolve(root, "data/generated");
const sourceDirectory = resolve(root, "src/generated");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, description: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Missing or invalid ${description}.`);
  return value;
}

function requiredIssueNumber(value: unknown, description: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Missing or invalid ${description}.`);
  return value;
}

function requiredNumber(value: unknown, description: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Missing or invalid ${description}.`);
  return value;
}

function optionalIssueNumber(
  value: unknown,
  description: string,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(requiredIssueNumber(value, description));
}

function optionalString(
  value: unknown,
  description: string,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string")
    throw new Error(`Missing or invalid ${description}.`);
  return value || undefined;
}

function optionalCode(value: unknown, description: string): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error(`Missing or invalid ${description}.`);
  const code = String(value);
  if (!code.trim()) throw new Error(`Missing or invalid ${description}.`);
  return code;
}

function requiredDate(value: unknown, description: string): string {
  if (!isRecord(value)) throw new Error(`Missing or invalid ${description}.`);
  const text = value["#text"];
  const date = typeof text === "number" ? String(text) : text;
  if (typeof date !== "string" || !/^\d{8}$/.test(date))
    throw new Error(`Missing or invalid ${description}.`);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function loadOfficialCodelists(input: unknown): {
  readonly issue: number;
  readonly codelists: SourceCodelist[];
} {
  if (!isRecord(input) || !isRecord(input.ONIXCodeTable))
    throw new Error("Official JSON must contain an ONIXCodeTable object.");
  const table = input.ONIXCodeTable;
  const issue = requiredIssueNumber(
    table.IssueNumber,
    "ONIXCodeTable IssueNumber",
  );
  if (!Array.isArray(table.CodeList))
    throw new Error("ONIXCodeTable must contain a CodeList array.");

  const numbers = new Set<number>();
  const codelists = table.CodeList.map((value, listIndex) => {
    const prefix = `codelist ${listIndex + 1}`;
    if (!isRecord(value)) throw new Error(`Invalid ${prefix}.`);
    const number = requiredIssueNumber(
      value.CodeListNumber,
      `${prefix} number`,
    );
    if (numbers.has(number)) throw new Error(`Duplicate codelist ${number}.`);
    numbers.add(number);
    const heading = requiredString(
      value.CodeListDescription,
      `${prefix} heading`,
    );
    requiredIssueNumber(value.IssueNumber, `${prefix} IssueNumber`);
    if (!Array.isArray(value.Code))
      throw new Error(`Missing ${prefix} Code array.`);

    const codes = new Set<string>();
    const entries = value.Code.map((entry, entryIndex) => {
      const entryPrefix = `entry ${entryIndex + 1} in codelist ${number}`;
      if (!isRecord(entry)) throw new Error(`Invalid ${entryPrefix}.`);
      const code = requiredString(entry.CodeValue, `${entryPrefix} code`);
      if (codes.has(code))
        throw new Error(
          `Duplicate code ${JSON.stringify(code)} in codelist ${number}.`,
        );
      codes.add(code);
      return {
        code,
        heading: requiredString(
          entry.CodeDescription,
          `${entryPrefix} heading`,
        ),
        note: optionalString(entry.CodeNotes, `${entryPrefix} notes`),
        issueAdded: optionalIssueNumber(
          entry.IssueNumber,
          `${entryPrefix} IssueNumber`,
        ),
        issueModified: optionalIssueNumber(
          entry.ModifiedNumber,
          `${entryPrefix} ModifiedNumber`,
        ),
        issueDeprecated: optionalIssueNumber(
          entry.DeprecatedNumber,
          `${entryPrefix} DeprecatedNumber`,
        ),
      };
    });
    return { number, heading, entries };
  });
  if (codelists.length === 0) throw new Error("No codelists were imported.");
  return {
    issue,
    codelists: codelists.sort((left, right) => left.number - right.number),
  };
}

function loadOfficialThema(input: unknown): {
  readonly issue: number;
  readonly version: string;
  readonly lastUpdated: string;
  readonly entries: SourceThemaEntry[];
} {
  if (!isRecord(input) || !isRecord(input.CodeList))
    throw new Error("Official Thema JSON must contain a CodeList object.");
  const list = input.CodeList;
  if (requiredIssueNumber(list.CodeListNumber, "Thema CodeListNumber") !== 214)
    throw new Error("Official Thema JSON must be codelist 214.");
  const issue = requiredNumber(list.IssueNumber, "Thema IssueNumber");
  const version = requiredString(list.VersionNumber, "Thema VersionNumber");
  const lastUpdated = requiredDate(list.LastUpdated, "Thema LastUpdated");
  if (!isRecord(list.ThemaCodes) || !Array.isArray(list.ThemaCodes.Code))
    throw new Error(
      "Official Thema JSON must contain a ThemaCodes Code array.",
    );

  const codes = new Set<string>();
  const entries = list.ThemaCodes.Code.map((value, entryIndex) => {
    const prefix = `Thema entry ${entryIndex + 1}`;
    if (!isRecord(value)) throw new Error(`Invalid ${prefix}.`);
    const code = requiredString(value.CodeValue, `${prefix} code`);
    if (codes.has(code)) throw new Error(`Duplicate Thema code ${code}.`);
    codes.add(code);
    const parentCode = optionalCode(value.CodeParent, `${prefix} parent code`);
    const note = optionalString(value.CodeNotes, `${prefix} notes`);
    return {
      code,
      heading: requiredString(value.CodeDescription, `${prefix} heading`),
      ...(parentCode === undefined ? {} : { parentCode }),
      ...(note === undefined ? {} : { note }),
    };
  });
  if (entries.length === 0) throw new Error("No Thema entries were imported.");
  for (const entry of entries) {
    if (entry.parentCode && !codes.has(entry.parentCode))
      throw new Error(
        `Thema code ${entry.code} references missing parent ${entry.parentCode}.`,
      );
  }
  return { issue, version, lastUpdated, entries };
}

async function main(): Promise<void> {
  const files = await readdir(rawDirectory);
  const jsonFiles = files.filter((file) =>
    /^ONIX_BookProduct_Codelists_Issue_\d+\.json$/i.test(file),
  );
  if (jsonFiles.length !== 1)
    throw new Error(
      "Expected exactly one official ONIX_BookProduct_Codelists_Issue_<n>.json file in data/raw/.",
    );
  const filename = jsonFiles[0];
  const filenameIssue = Number(/Issue_(\d+)/i.exec(filename)?.[1]);
  if (!Number.isSafeInteger(filenameIssue))
    throw new Error(`Could not determine issue from ${filename}.`);
  const { issue, codelists } = loadOfficialCodelists(
    JSON.parse(
      await readFile(resolve(rawDirectory, filename), "utf8"),
    ) as unknown,
  );
  if (issue !== filenameIssue)
    throw new Error(
      `IssueNumber ${issue} does not match Issue ${filenameIssue} in ${filename}.`,
    );

  const generatedAt = new Date().toISOString();
  const metadata = { issue, generatedAt };
  await mkdir(generatedDirectory, { recursive: true });
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    resolve(generatedDirectory, "codelists.json"),
    `${JSON.stringify(codelists)}\n`,
  );
  await writeFile(
    resolve(generatedDirectory, "metadata.json"),
    `${JSON.stringify(metadata)}\n`,
  );
  const runtimeLists = codelists.map(({ number, heading, entries }) => ({
    number,
    heading,
    entries: entries.map(({ code, heading }) => ({ code, heading })),
  }));
  await writeFile(
    resolve(sourceDirectory, "codelists.ts"),
    `// Generated from ${basename(filename)}. Do not edit manually.\nimport type { Codelist, CodelistEntry } from "../types/codelist.js";\n\nexport const codelists: readonly Codelist[] = ${JSON.stringify(runtimeLists)};\nexport const codelistsByNumber = new Map(codelists.map((codelist) => [codelist.number, codelist]));\nexport const codelistEntriesByCode = new Map<number, ReadonlyMap<string, CodelistEntry>>(codelists.map((codelist) => [codelist.number, new Map(codelist.entries.map((entry) => [entry.code, entry]))]));\n`,
  );
  await writeFile(
    resolve(sourceDirectory, "metadata.ts"),
    `// Generated from ${basename(filename)}. Do not edit manually.\nimport type { CodelistMetadata } from "../types/metadata.js";\n\nexport const metadata: CodelistMetadata = ${JSON.stringify(metadata)};\n`,
  );

  const themaFiles = files.filter((file) =>
    /^\d{8}_Thema_v[\d.]+_en\.json$/i.test(file),
  );
  if (themaFiles.length !== 1)
    throw new Error(
      "Expected exactly one official <date>_Thema_v<version>_en.json file in data/raw/.",
    );
  const themaFilename = themaFiles[0];
  const thema = loadOfficialThema(
    JSON.parse(
      await readFile(resolve(rawDirectory, themaFilename), "utf8"),
    ) as unknown,
  );
  const themaMetadata = {
    issue: thema.issue,
    version: thema.version,
    lastUpdated: thema.lastUpdated,
    generatedAt,
  };
  await writeFile(
    resolve(generatedDirectory, "thema.json"),
    `${JSON.stringify(thema.entries)}\n`,
  );
  await writeFile(
    resolve(generatedDirectory, "thema-metadata.json"),
    `${JSON.stringify(themaMetadata)}\n`,
  );
  await writeFile(
    resolve(sourceDirectory, "thema.ts"),
    `// Generated from ${basename(themaFilename)}. Do not edit manually.\nimport type { ThemaEntry } from "../types/thema.js";\n\nexport const themaEntries: readonly ThemaEntry[] = ${JSON.stringify(thema.entries)};\nexport const themaEntriesByCode = new Map<string, ThemaEntry>(themaEntries.map((entry) => [entry.code, entry]));\nexport const themaEntriesByParent = new Map<string | undefined, ThemaEntry[]>();\nfor (const entry of themaEntries) {\n  const children = themaEntriesByParent.get(entry.parentCode);\n  if (children) children.push(entry);\n  else themaEntriesByParent.set(entry.parentCode, [entry]);\n}\n`,
  );
  await writeFile(
    resolve(sourceDirectory, "thema-metadata.ts"),
    `// Generated from ${basename(themaFilename)}. Do not edit manually.\nimport type { ThemaMetadata } from "../types/thema.js";\n\nexport const themaMetadata: ThemaMetadata = ${JSON.stringify(themaMetadata)};\n`,
  );
  console.log(
    `Generated ${codelists.length} codelists from Issue ${issue} and ${thema.entries.length} Thema entries from ${thema.version}.`,
  );
}

await main();
