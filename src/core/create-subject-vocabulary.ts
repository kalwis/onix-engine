import { getCodelistEntry } from "./get-codelist-entry.js";
import type {
  SubjectVocabulary,
  SubjectVocabularyDocument,
  SubjectVocabularyEntry,
  SubjectVocabularyMetadata,
} from "../types/subject-vocabulary.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new TypeError(`${field} must be a non-blank string.`);
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, field);
}

function parseDocument(input: string | SubjectVocabularyDocument): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON error.";
    throw new TypeError(`Subject vocabulary JSON is invalid: ${message}`);
  }
}

/**
 * Creates an immutable, application-supplied ONIX subject vocabulary.
 * The caller is responsible for obtaining and licensing any external data.
 */
export function createSubjectVocabulary(
  input: string | SubjectVocabularyDocument,
): SubjectVocabulary {
  const document = parseDocument(input);
  if (!isRecord(document))
    throw new TypeError("Subject vocabulary must be a JSON object.");

  const onixSchemeCode = requiredText(
    document.onixSchemeCode,
    "Subject vocabulary onixSchemeCode",
  );
  if (!getCodelistEntry(27, onixSchemeCode))
    throw new RangeError(
      `Subject vocabulary scheme ${onixSchemeCode} is not an ONIX List 27 code.`,
    );

  const metadata: SubjectVocabularyMetadata = Object.freeze({
    onixSchemeCode,
    name: requiredText(document.name, "Subject vocabulary name"),
    version: requiredText(document.version, "Subject vocabulary version"),
  });
  if (!Array.isArray(document.entries) || document.entries.length === 0)
    throw new TypeError(
      "Subject vocabulary entries must be a non-empty array.",
    );

  const codes = new Set<string>();
  const entries = document.entries.map((value, index) => {
    const prefix = `Subject vocabulary entry ${index + 1}`;
    if (!isRecord(value)) throw new TypeError(`${prefix} must be an object.`);

    const code = requiredText(value.code, `${prefix} code`);
    if (codes.has(code))
      throw new TypeError(`Duplicate subject vocabulary code ${code}.`);
    codes.add(code);

    const parentCode = optionalText(value.parentCode, `${prefix} parentCode`);
    const note = optionalText(value.note, `${prefix} note`);
    return Object.freeze({
      code,
      heading: requiredText(value.heading, `${prefix} heading`),
      ...(parentCode === undefined ? {} : { parentCode }),
      ...(note === undefined ? {} : { note }),
    });
  });

  for (const entry of entries) {
    if (entry.parentCode && !codes.has(entry.parentCode))
      throw new TypeError(
        `Subject vocabulary code ${entry.code} references missing parent ${entry.parentCode}.`,
      );
  }

  const immutableEntries = Object.freeze(
    entries,
  ) as readonly SubjectVocabularyEntry[];
  const entriesByCode = new Map(
    immutableEntries.map((entry) => [entry.code, entry]),
  );
  const entriesByParent = new Map<
    string | undefined,
    SubjectVocabularyEntry[]
  >();
  for (const entry of immutableEntries) {
    const children = entriesByParent.get(entry.parentCode);
    if (children) children.push(entry);
    else entriesByParent.set(entry.parentCode, [entry]);
  }
  const immutableChildren = new Map(
    [...entriesByParent].map(([parentCode, children]) => [
      parentCode,
      Object.freeze(children) as readonly SubjectVocabularyEntry[],
    ]),
  );

  const vocabulary: SubjectVocabulary = {
    metadata,
    getEntries: () => immutableEntries,
    getEntry: (code) => entriesByCode.get(code),
    getHeading: (code) => entriesByCode.get(code)?.heading,
    hasCode: (code) => entriesByCode.has(code),
    getChildren: (parentCode) => immutableChildren.get(parentCode) ?? [],
  };
  return Object.freeze(vocabulary);
}
