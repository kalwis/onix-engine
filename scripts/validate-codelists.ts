import { codelists } from "../src/generated/codelists.js";
import { metadata } from "../src/generated/metadata.js";
import { themaEntries } from "../src/generated/thema.js";
import { themaMetadata } from "../src/generated/thema-metadata.js";

if (!Number.isSafeInteger(metadata.issue))
  throw new Error("Metadata issue must be an integer.");
for (const list of codelists) {
  if (!Number.isSafeInteger(list.number) || !list.heading.trim())
    throw new Error("Invalid codelist.");
  const codes = new Set<string>();
  for (const entry of list.entries) {
    if (typeof entry.code !== "string" || !entry.code || !entry.heading.trim())
      throw new Error(`Invalid entry in codelist ${list.number}.`);
    if (codes.has(entry.code))
      throw new Error(
        `Duplicate code ${entry.code} in codelist ${list.number}.`,
      );
    codes.add(entry.code);
  }
}
if (!Number.isFinite(themaMetadata.issue) || !themaMetadata.version.trim())
  throw new Error("Invalid Thema metadata.");
if (!/^\d{4}-\d{2}-\d{2}$/.test(themaMetadata.lastUpdated))
  throw new Error("Invalid Thema last-updated date.");
const themaCodes = new Set<string>();
for (const entry of themaEntries) {
  if (!entry.code || !entry.heading.trim())
    throw new Error("Invalid Thema entry.");
  if (themaCodes.has(entry.code))
    throw new Error(`Duplicate Thema code ${entry.code}.`);
  themaCodes.add(entry.code);
}
for (const entry of themaEntries) {
  if (entry.parentCode && !themaCodes.has(entry.parentCode))
    throw new Error(
      `Thema code ${entry.code} references missing parent ${entry.parentCode}.`,
    );
}
console.log(
  `Validated ${codelists.length} codelists from Issue ${metadata.issue} and ${themaEntries.length} Thema entries from ${themaMetadata.version}.`,
);
