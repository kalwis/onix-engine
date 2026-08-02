import { codelists } from "../src/generated/codelists.js";
import { metadata } from "../src/generated/metadata.js";

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
console.log(
  `Validated ${codelists.length} codelists from Issue ${metadata.issue}.`,
);
