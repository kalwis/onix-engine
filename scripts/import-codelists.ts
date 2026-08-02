/** Build-time importer for official EDItEUR ONIX codelist CSV files. */
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

const root = resolve(import.meta.dirname, "..");
const rawDirectory = resolve(root, "data/raw");
const generatedDirectory = resolve(root, "data/generated");
const sourceDirectory = resolve(root, "src/generated");

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field.length > 0)
        throw new Error("Unsafe CSV: quote inside an unquoted field.");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Unsafe CSV: unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

async function readOfficialCsv(path: string): Promise<string> {
  const bytes = await readFile(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Historic EDItEUR CSV downloads use Windows-1252 punctuation. Decode it
    // explicitly rather than replacing official characters with U+FFFD.
    return new TextDecoder("windows-1252", { fatal: true }).decode(bytes);
  }
}

async function loadHeadings(): Promise<Record<string, string>> {
  const files = await readdir(rawDirectory);
  const headingFiles = files.filter((file) =>
    /^codelist-headings.*\.json$/i.test(file),
  );
  if (headingFiles.length > 1)
    throw new Error("Expected at most one codelist-headings JSON file.");
  if (headingFiles.length === 0) return {};
  const value: unknown = JSON.parse(
    await readFile(resolve(rawDirectory, headingFiles[0]), "utf8"),
  );
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "Codelist headings JSON must be an object keyed by codelist number.",
    );
  }
  for (const [number, heading] of Object.entries(value)) {
    if (
      !/^\d+$/.test(number) ||
      typeof heading !== "string" ||
      !heading.trim()
    ) {
      throw new Error(
        "Codelist headings JSON contains an invalid number or heading.",
      );
    }
  }
  return value as Record<string, string>;
}

async function main(): Promise<void> {
  const files = await readdir(rawDirectory);
  const csvFiles = files.filter((file) =>
    /^ONIX_BookProduct_Codelists_Issue_\d+\.csv$/i.test(file),
  );
  if (csvFiles.length !== 1) {
    throw new Error(
      "Expected exactly one official ONIX_BookProduct_Codelists_Issue_<n>.csv file in data/raw/.",
    );
  }

  const filename = csvFiles[0];
  const issue = Number(/Issue_(\d+)/i.exec(filename)?.[1]);
  if (!Number.isSafeInteger(issue))
    throw new Error(`Could not determine issue from ${filename}.`);
  const rows = parseCsv(await readOfficialCsv(resolve(rawDirectory, filename)));
  const headings = await loadHeadings();
  const lists = new Map<number, { heading: string; entries: SourceEntry[] }>();

  for (const [lineIndex, row] of rows.entries()) {
    if (row.length < 3)
      throw new Error(`Could not safely parse CSV row ${lineIndex + 1}.`);
    const [
      numberText,
      code,
      heading,
      note,
      issueAdded,
      issueModified,
      issueDeprecated,
    ] = row;
    if (!/^\d+$/.test(numberText))
      throw new Error(
        `Missing or invalid codelist number on row ${lineIndex + 1}.`,
      );
    if (typeof code !== "string" || code.length === 0)
      throw new Error(`Missing code on row ${lineIndex + 1}.`);
    if (typeof heading !== "string" || heading.trim().length === 0)
      throw new Error(`Missing heading on row ${lineIndex + 1}.`);
    const number = Number(numberText);
    const list = lists.get(number) ?? {
      // The CSV does not contain list titles. A companion official headings file takes precedence.
      heading: headings[numberText] ?? `ONIX codelist ${numberText}`,
      entries: [],
    };
    if (list.entries.some((entry) => entry.code === code)) {
      throw new Error(
        `Duplicate code ${JSON.stringify(code)} in codelist ${number}.`,
      );
    }
    list.entries.push({
      code,
      heading,
      note: optional(note),
      issueAdded: optional(issueAdded),
      issueModified: optional(issueModified),
      issueDeprecated: optional(issueDeprecated),
    });
    lists.set(number, list);
  }

  const codelists: SourceCodelist[] = [...lists.entries()]
    .map(([number, list]) => ({
      number,
      heading: list.heading,
      entries: list.entries,
    }))
    .sort((left, right) => left.number - right.number);
  if (codelists.length === 0) throw new Error("No codelists were imported.");
  for (const list of codelists) {
    if (!Number.isSafeInteger(list.number) || !list.heading.trim())
      throw new Error("Invalid generated codelist.");
  }

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
  console.log(`Generated ${codelists.length} codelists from Issue ${issue}.`);
}

await main();
