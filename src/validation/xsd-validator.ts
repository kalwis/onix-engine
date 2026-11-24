import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ValidationResult } from "../types/validation-result.js";

const schemaVersion = "3.1.3.1" as const;
const referenceNamespace = "http://ns.editeur.org/onix/3.1/reference";
const shortNamespace = "http://ns.editeur.org/onix/3.1/short";
const runtimeDirectory =
  typeof __dirname === "string"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
const standardsDirectories = [
  resolve(runtimeDirectory, "../standards/onix/3.1.3"),
  resolve(runtimeDirectory, "../../standards/onix/3.1.3"),
];
const files = {
  reference: "ONIX_BookProduct_3.1_reference.xsd",
  short: "ONIX_BookProduct_3.1_short.xsd",
};
const includedFiles = [
  "ONIX_BookProduct_CodeLists.xsd",
  "ONIX_XHTML_Subset.xsd",
] as const;

let schemasPromise: Promise<Record<string, string>> | undefined;
async function readStandard(file: string): Promise<string> {
  for (const directory of standardsDirectories) {
    try {
      return await readFile(resolve(directory, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Packaged ONIX XSD is missing: ${file}`);
}
function schemas() {
  schemasPromise ??= Promise.all(
    [...Object.values(files), ...includedFiles].map(
      async (file) => [file, await readStandard(file)] as const,
    ),
  ).then((entries) => Object.fromEntries(entries));
  return schemasPromise;
}

function tagStyle(xml: string): "reference" | "short" | undefined {
  const start = /<(ONIXMessage|ONIXmessage)\b([^>]*)>/.exec(xml);
  if (!start) return undefined;
  const namespace = /\bxmlns\s*=\s*(["'])(.*?)\1/.exec(start[2]!);
  if (start[1] === "ONIXMessage" && namespace?.[2] === referenceNamespace)
    return "reference";
  if (start[1] === "ONIXmessage" && namespace?.[2] === shortNamespace)
    return "short";
  return start[1] === "ONIXmessage" ? "short" : "reference";
}

/** Validate ONIX XML against the official non-strict ONIX 3.1.3 XSDs. */
export async function validateOnix(xml: string): Promise<ValidationResult> {
  const tags = tagStyle(xml);
  const [source, { validateXML }] = await Promise.all([
    schemas(),
    import("xmllint-wasm"),
  ]);
  const schemaFile = files[tags ?? "reference"];
  const result = await validateXML({
    xml: [{ fileName: "onix.xml", contents: xml }],
    schema: [{ fileName: schemaFile, contents: source[schemaFile] }],
    preload: includedFiles.map((fileName) => ({
      fileName,
      contents: source[fileName],
    })),
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => ({
      message: error.message,
      ...(error.loc?.lineNumber ? { line: error.loc.lineNumber } : {}),
    })),
    schemaVersion,
    ...(tags ? { tags } : {}),
  };
}

export type {
  ValidationError,
  ValidationResult,
} from "../types/validation-result.js";
