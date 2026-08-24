/** Compile auditable semantic inputs from the pinned ONIX codelists and XSD. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Entry = { code: string; note?: string; issueDeprecated?: string };
type Codelist = { number: number; entries: Entry[] };
type Schema = {
  documents: { path: string; components: { kind: string; name?: string }[] }[];
};

const root = resolve(import.meta.dirname, "..");
const referenceXsd = resolve(
  root,
  "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74/ONIX_BookProduct_3.1_reference.xsd",
);
const schematronXsd = resolve(
  root,
  "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74/ONIX_BookProduct_3.1_reference_strict.xsd",
);
const reviewedDetails = new Set([
  "A101",
  "A102",
  "A103",
  "A104",
  "A105",
  "A106",
  "A107",
  "A108",
  "A109",
  "A110",
  "A111",
  "A112",
  "A113",
  "A301",
  "A302",
  "A303",
  "A304",
  "A305",
  "A310",
  "A311",
  "A312",
  "A410",
  "A420",
  "A421",
  "A441",
  "A451",
  "A471",
  "B101",
  "B102",
  "B103",
  "B104",
  "B105",
  "B106",
  "B107",
  "B113",
  "B114",
  "B115",
  "B116",
  "B117",
  "B118",
  "B131",
  "B132",
  "B133",
  "B135",
  "B201",
  "B202",
  "B204",
  "B205",
  "B206",
  "B207",
  "B208",
  "B209",
  "B210",
  "B212",
  "B213",
  "B214",
  "B215",
  "B216",
  "B221",
  "B222",
  "B223",
  "B301",
  "B302",
  "B303",
  "B306",
  "B311",
  "B312",
  "B314",
  "B403",
  "B404",
  "B405",
  "D201",
  "D202",
  "D203",
  "D204",
  "D205",
  "D206",
  "D207",
  "P101",
  "P102",
  "P103",
  "P104",
  "P105",
  "P106",
  "P107",
  "P108",
  "P109",
  "P110",
  "P111",
  "P112",
  "P113",
  "P115",
  "P116",
  "P131",
  "P132",
  "P133",
  "P134",
]);
const expectedCoverage = {
  notes: 3399,
  identifierContexts: 25,
  schematronIds: 1293,
};

function productForms(note: string): string[] | undefined {
  return /use with product form codes?\s+([^.;]+)/i
    .exec(note)?.[1]
    .match(/\b[A-Z]{2}\b|\b[A-Z]\*/gi)
    ?.map((value) => value.toUpperCase());
}
function requiredDetails(note: string): string[] | undefined {
  return /and product form detail codes?\s+([^.;]+)/i
    .exec(note)?.[1]
    .match(/\b[A-Z]\d{3}\b/gi)
    ?.map((value) => value.toUpperCase());
}
function elementBlock(xsd: string, name: string): string | undefined {
  return new RegExp(
    `<xs:element name="${name}">([\\s\\S]*?)</xs:element>`,
  ).exec(xsd)?.[1];
}

async function main(): Promise<void> {
  const [codelists, schema, xsd, schematron] = await Promise.all([
    readFile(resolve(root, "data/generated/codelists.json"), "utf8").then(
      JSON.parse,
    ) as Promise<Codelist[]>,
    readFile(
      resolve(root, "data/generated/onix-3.1.3-schema.json"),
      "utf8",
    ).then(JSON.parse) as Promise<Schema>,
    readFile(referenceXsd, "utf8"),
    readFile(schematronXsd, "utf8"),
  ]);
  const details = codelists.find((list) => list.number === 175);
  if (!details) throw new Error("Missing ONIX Code List 175.");
  const productFormDetailRules = details.entries.flatMap((entry) => {
    if (!entry.note) return [];
    const forms = productForms(entry.note);
    if (!forms) return [];
    return [
      {
        detail: entry.code,
        allowedForms: forms.filter((form) => !form.endsWith("*")),
        allowedFormPrefixes: forms
          .filter((form) => form.endsWith("*"))
          .map((form) => form.slice(0, -1)),
        ...(requiredDetails(entry.note)
          ? { requiredDetails: requiredDetails(entry.note) }
          : {}),
        note: entry.note,
      },
    ];
  });
  const audit = codelists.flatMap((list) =>
    list.entries
      .filter((entry) => entry.note)
      .map((entry) => {
        const supported =
          list.number === 175 &&
          productFormDetailRules.some((rule) => rule.detail === entry.code);
        return {
          list: list.number,
          code: entry.code,
          note: entry.note!,
          source: {
            type: "codelist-note",
            list: list.number,
            code: entry.code,
            text: entry.note!,
          },
          extraction: supported ? "product-form" : "unsupported",
          classification: supported
            ? reviewedDetails.has(entry.code)
              ? "reviewed-override"
              : "supported-rule"
            : "unsupported-candidate",
        };
      }),
  );
  // Only identifier composites carry the IDType / IDValue tuple. Simple values
  // such as SubjectSchemeIdentifier are ordinary codelist fields.
  const contexts = [
    ...new Set(
      schema.documents.flatMap((document) =>
        document.components
          .filter(
            (component) =>
              component.kind === "element" &&
              component.name?.endsWith("Identifier") &&
              elementBlock(xsd, component.name!)?.includes('ref="IDValue"'),
          )
          .map((component) => component.name!),
      ),
    ),
  ].sort();
  const registry = contexts.map((context) => {
    const block = elementBlock(xsd, context);
    const typeName = /ref="([A-Za-z]+IDType)"/.exec(block ?? "")?.[1];
    const typeBlock = typeName ? elementBlock(xsd, typeName) : undefined;
    const list = /base="List(\d+)"/.exec(typeBlock ?? "")?.[1];
    const typeShortName =
      /<xs:attribute name="shortname">[\s\S]*?<xs:enumeration value="([a-z][a-z0-9]*)"/.exec(
        typeBlock ?? "",
      )?.[1];
    const shortName =
      /<xs:attribute name="shortname">[\s\S]*?<xs:enumeration value="([a-z][a-z0-9]*)"/.exec(
        block ?? "",
      )?.[1];
    if (!typeName || !list || !shortName || !typeShortName)
      throw new Error(
        `Unmapped identifier context ${context}; add an explicit XSD mapping.`,
      );
    return {
      context,
      typeName,
      typeShortName,
      typeList: Number(list),
      shortName,
      source: { type: "schema", id: `${context}:${typeName}:List${list}` },
    };
  });
  const sourceIds = [...schematron.matchAll(/<xs:assert id="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  if (
    registry.length !== contexts.length ||
    new Set(sourceIds).size !== sourceIds.length ||
    audit.length !== expectedCoverage.notes ||
    registry.length !== expectedCoverage.identifierContexts ||
    sourceIds.length !== expectedCoverage.schematronIds
  )
    throw new Error(
      "Semantic source coverage changed unexpectedly; review the pinned-source delta and update the explicit baseline.",
    );
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  const deprecatedIdentifierTypes = registry.flatMap(
    (context) =>
      codelists
        .find((list) => list.number === context.typeList)
        ?.entries.filter((entry) => entry.issueDeprecated)
        .map((entry) => ({
          context: context.context,
          typeList: context.typeList,
          code: entry.code,
          issueDeprecated: entry.issueDeprecated!,
          note: entry.note,
        })) ?? [],
  );
  await writeFile(
    resolve(root, "src/generated/semantic-manifest.ts"),
    `// Generated by scripts/generate-semantic-manifest.ts. Do not edit.\nexport const productFormDetailRules = Object.freeze(${JSON.stringify(productFormDetailRules, null, 2)});\n\nexport const semanticCodelistNoteAudit = Object.freeze(${JSON.stringify(audit, null, 2)});\n\nexport const identifierContextRegistry = Object.freeze(${JSON.stringify(registry, null, 2)});\n\nexport const deprecatedIdentifierTypes = Object.freeze(${JSON.stringify(deprecatedIdentifierTypes, null, 2)});\n\nexport const semanticSchemaSourceIds = Object.freeze(${JSON.stringify(sourceIds, null, 2)});\n`,
  );
  console.log(
    `Generated ${audit.length} codelist-note audit entries, ${registry.length} identifier contexts, and ${sourceIds.length} Schematron source IDs.`,
  );
}
await main();
