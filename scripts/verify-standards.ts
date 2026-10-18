import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(
  root,
  "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74",
);
const packaged = resolve(root, "standards/onix/3.1.3");
const files = [
  "ONIX_BookProduct_3.1_reference.xsd",
  "ONIX_BookProduct_3.1_short.xsd",
  "ONIX_BookProduct_CodeLists.xsd",
  "ONIX_XHTML_Subset.xsd",
];

for (const file of files) {
  const [original, copy] = await Promise.all([
    readFile(resolve(source, file)),
    readFile(resolve(packaged, file)),
  ]);
  if (!original.equals(copy))
    throw new Error(`Packaged standard differs from official source: ${file}`);
  if (file.includes("3.1_") && !copy.toString().includes('version="3.1.3.1"'))
    throw new Error(`Unexpected schema version: ${file}`);
}

for (const style of ["reference", "short"]) {
  const schema = await readFile(
    resolve(packaged, `ONIX_BookProduct_3.1_${style}.xsd`),
    "utf8",
  );
  for (const included of files.slice(2)) {
    if (!schema.includes(`schemaLocation="${included}"`))
      throw new Error(`${style} schema no longer includes ${included}`);
  }
}

const codelistStructure = JSON.parse(
  await readFile(
    resolve(root, "data/raw/ONIX_BookProduct_Codelist_Structure.json"),
    "utf8",
  ),
) as { title?: string };
if (codelistStructure.title !== "JSON schema for ONIX codelists")
  throw new Error("Unexpected official codelist structure file.");

console.log(
  "Verified four packaged ONIX XSDs and the codelist structure source.",
);
