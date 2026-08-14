import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SaxesParser } from "saxes";
import schema from "../data/generated/onix-3.1.3-schema.json" with { type: "json" };

const root = resolve(import.meta.dirname, "..");
for (const file of schema.manifest.files) {
  const contents = await readFile(resolve(root, file.path));
  if (createHash("sha256").update(contents).digest("hex") !== file.sha256)
    throw new Error(`Hash mismatch: ${file.path}`);
  await access(resolve(root, file.path));
}
if (schema.schemaVersion !== "3.1.3.74.0" || schema.codelistIssue !== 74)
  throw new Error("Unexpected ONIX source version.");
if (
  !schema.documents.some((document) =>
    document.path.endsWith("ONIX_BookProduct_CodeLists.xsd"),
  ) ||
  !schema.documents.some((document) =>
    document.path.endsWith("ONIX_XHTML_Subset.xsd"),
  )
)
  throw new Error("Missing included modules.");
if (
  !schema.aliases.some((alias) => alias.reference === "ONIXMessage") ||
  !schema.aliases.some((alias) => alias.reference === "Header") ||
  !schema.aliases.some((alias) => alias.reference === "Product")
)
  throw new Error("Missing known aliases.");
if (
  !schema.documents
    .flatMap((document) => document.rules)
    .some((rule) => rule.kind === "assert") ||
  !schema.documents
    .flatMap((document) => document.rules)
    .some((rule) => rule.kind === "report")
)
  throw new Error("Rules were not captured.");
for (const sample of schema.manifest.samples) {
  const xml = await readFile(
    resolve(
      root,
      "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74",
      sample,
    ),
    "utf8",
  );
  const parser = new SaxesParser({ xmlns: true });
  let seen = false;
  parser.on("opentag", (tag) => {
    if (seen) return;
    seen = true;
    const short = sample.includes("shorttags");
    if (
      tag.local !== (short ? "ONIXmessage" : "ONIXMessage") ||
      tag.attributes.release?.value !== "3.1" ||
      !tag.uri.includes(short ? "/short" : "/reference")
    )
      throw new Error(`Invalid official sample ${sample}.`);
  });
  parser.write(xml).close();
}
console.log(
  `Validated ONIX schema manifest, ${schema.documents.length} documents, and ${schema.aliases.length} aliases.`,
);
