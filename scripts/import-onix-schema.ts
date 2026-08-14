/** Build-time importer for the pinned EDItEUR ONIX 3.1.3 strict XSD source. */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { SaxesParser, type SaxesTag } from "saxes";

const root = resolve(import.meta.dirname, "..");
const rawDirectory = resolve(
  root,
  "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74",
);
const generatedDirectory = resolve(root, "data/generated");
const sourceDirectory = resolve(root, "src/generated");
const xsdNamespace = "http://www.w3.org/2001/XMLSchema";
const schematronNamespace = "http://purl.oclc.org/dsdl/schematron";

type Node = {
  name: string;
  uri: string;
  attributes: Record<string, string>;
  text: string;
  children: Node[];
};
type Component = {
  id: string;
  kind: string;
  name?: string;
  scope: "global" | "local";
  source: string;
  attributes: Record<string, string>;
  content: ContentNode[];
  facets?: Facet[];
  derivation?: { kind: "extension" | "restriction"; base?: string };
};
type ContentNode = {
  kind: "sequence" | "choice" | "all" | "element" | "group" | "any";
  minOccurs: string;
  maxOccurs: string;
  name?: string;
  ref?: string;
  children?: ContentNode[];
};
type Facet = { kind: string; value?: string; fixed?: string };
type Rule = {
  id: string;
  kind: "assert" | "unique" | "report";
  severity?: string;
  context?: string;
  test?: string;
  message?: string;
  source: string;
};

const allowedXsd = new Set([
  "schema",
  "include",
  "annotation",
  "appinfo",
  "documentation",
  "element",
  "complexType",
  "simpleType",
  "group",
  "attributeGroup",
  "attribute",
  "sequence",
  "choice",
  "all",
  "any",
  "complexContent",
  "simpleContent",
  "extension",
  "restriction",
  "list",
  "union",
  "enumeration",
  "pattern",
  "minLength",
  "minInclusive",
  "maxInclusive",
  "minExclusive",
  "assert",
  "assertion",
  "unique",
  "selector",
  "field",
]);

function attrs(tag: SaxesTag): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tag.attributes).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value.value,
    ]),
  );
}

function parseXml(source: string, label: string): Promise<Node> {
  return new Promise((resolveParse, reject) => {
    const parser = new SaxesParser({ xmlns: true });
    const stack: Node[] = [];
    let documentRoot: Node | undefined;
    parser.on("opentag", (tag: SaxesTag) => {
      const local = tag.local ?? "";
      const uri = tag.uri ?? "";
      if (uri === xsdNamespace && !allowedXsd.has(local)) {
        reject(
          new Error(`Unsupported XSD construct xs:${tag.local} in ${label}.`),
        );
        return;
      }
      const node: Node = {
        name: local,
        uri,
        attributes: attrs(tag),
        text: "",
        children: [],
      };
      if (stack.length) stack.at(-1)?.children.push(node);
      else documentRoot = node;
      stack.push(node);
    });
    parser.on("text", (text: string) => {
      if (stack.length) stack.at(-1)!.text += text;
    });
    parser.on("closetag", () => {
      stack.pop();
    });
    parser.on("error", (error: Error) =>
      reject(new Error(`Invalid XML in ${label}: ${error.message}`)),
    );
    parser.on("end", () =>
      documentRoot
        ? resolveParse(documentRoot)
        : reject(new Error(`No document element in ${label}.`)),
    );
    parser.write(source).close();
  });
}

function hash(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}
function occurrence(node: Node): Pick<ContentNode, "minOccurs" | "maxOccurs"> {
  return {
    minOccurs: node.attributes.minOccurs ?? "1",
    maxOccurs: node.attributes.maxOccurs ?? "1",
  };
}
function content(node: Node): ContentNode[] {
  return node.children
    .filter(
      (child) =>
        child.uri === xsdNamespace &&
        ["sequence", "choice", "all", "element", "group", "any"].includes(
          child.name,
        ),
    )
    .map((child) => ({
      kind: child.name as ContentNode["kind"],
      ...occurrence(child),
      ...(child.attributes.name ? { name: child.attributes.name } : {}),
      ...(child.attributes.ref ? { ref: child.attributes.ref } : {}),
      ...(["sequence", "choice", "all"].includes(child.name)
        ? { children: content(child) }
        : {}),
    }));
}
function descendants(node: Node): Node[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}
function isComponent(node: Node): boolean {
  return (
    node.uri === xsdNamespace &&
    [
      "element",
      "complexType",
      "simpleType",
      "group",
      "attributeGroup",
      "attribute",
    ].includes(node.name)
  );
}
function component(
  node: Node,
  source: string,
  ordinal: number,
  parent?: Node,
): Component {
  const name = node.attributes.name;
  const scope = parent?.name === "schema" ? "global" : "local";
  const nested = descendants(node);
  const derivationNode = nested.find(
    (child) =>
      child.uri === xsdNamespace &&
      (child.name === "extension" || child.name === "restriction"),
  );
  const facets = nested
    .filter(
      (child) =>
        child.uri === xsdNamespace &&
        [
          "enumeration",
          "pattern",
          "minLength",
          "minInclusive",
          "maxInclusive",
          "minExclusive",
        ].includes(child.name),
    )
    .map((facet) => ({
      kind: facet.name,
      ...(facet.attributes.value ? { value: facet.attributes.value } : {}),
      ...(facet.attributes.fixed ? { fixed: facet.attributes.fixed } : {}),
    }));
  return {
    id: `${source}#${node.name}:${name ?? `local-${ordinal}`}`,
    kind: node.name,
    ...(name ? { name } : {}),
    scope,
    source,
    attributes: node.attributes,
    content: content(node),
    ...(facets.length ? { facets } : {}),
    ...(derivationNode
      ? {
          derivation: {
            kind: derivationNode.name as "extension" | "restriction",
            ...(derivationNode.attributes.base
              ? { base: derivationNode.attributes.base }
              : {}),
          },
        }
      : {}),
  };
}
function collectComponents(schema: Node, source: string): Component[] {
  const result: Component[] = [];
  const visit = (node: Node, parent?: Node): void => {
    if (isComponent(node))
      result.push(component(node, source, result.length, parent));
    for (const child of node.children) visit(child, node);
  };
  visit(schema);
  return result;
}
function rules(schema: Node, source: string): Rule[] {
  const result: Rule[] = [];
  for (const node of descendants(schema)) {
    if (
      node.uri === xsdNamespace &&
      (node.name === "assert" || node.name === "unique")
    )
      result.push({
        id: node.attributes.id ?? `${source}:${node.name}:${result.length + 1}`,
        kind: node.name,
        ...(node.attributes.test ? { test: node.attributes.test } : {}),
        ...(node.attributes.name ? { context: node.attributes.name } : {}),
        source,
      });
    if (node.uri === schematronNamespace && node.name === "report") {
      const rule = findParent(schema, node, "rule");
      result.push({
        id: node.attributes.id ?? `${source}:report:${result.length + 1}`,
        kind: "report",
        ...(node.attributes.role ? { severity: node.attributes.role } : {}),
        ...(rule?.attributes.context
          ? { context: rule.attributes.context }
          : {}),
        ...(node.attributes.test ? { test: node.attributes.test } : {}),
        ...(node.text.trim() ? { message: node.text.trim() } : {}),
        source,
      });
    }
  }
  return result;
}
function findParent(
  rootNode: Node,
  target: Node,
  kind: string,
): Node | undefined {
  const visit = (node: Node, ancestors: Node[]): Node | undefined => {
    if (node === target)
      return [...ancestors]
        .reverse()
        .find((ancestor) => ancestor.name === kind);
    for (const child of node.children) {
      const found = visit(child, [...ancestors, node]);
      if (found) return found;
    }
  };
  return visit(rootNode, []);
}

async function main(): Promise<void> {
  const names = (await readdir(rawDirectory)).sort();
  const legacyXsl = resolve(
    root,
    "scripts/switch-onix-3.0-tagnames-2.0_v1.3.xsl",
  );
  const files = [
    ...names.map((name) => resolve(rawDirectory, name)),
    legacyXsl,
  ];
  const sourceFiles = await Promise.all(
    files.map(async (file) => ({
      path: relative(root, file).replaceAll("\\", "/"),
      sha256: hash(await readFile(file)),
    })),
  );
  const strictRoots = [
    "ONIX_BookProduct_3.1_reference_strict.xsd",
    "ONIX_BookProduct_3.1_short_strict.xsd",
  ];
  const parsed = new Map<string, Node>();
  for (const name of names.filter((name) => name.endsWith(".xsd")))
    parsed.set(
      name,
      await parseXml(await readFile(resolve(rawDirectory, name), "utf8"), name),
    );
  const roots = strictRoots.map((name) => ({
    name,
    schema: parsed.get(name)!,
  }));
  for (const { name, schema } of roots) {
    if (schema.attributes.version !== "3.1.3.74.0")
      throw new Error(`${name} must declare schema version 3.1.3.74.0.`);
  }
  const documents = [...parsed]
    .map(([name, schema]) => ({
      path: `data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74/${name}`,
      namespace: schema.attributes.targetNamespace,
      version: schema.attributes.version,
      includes: schema.children
        .filter((node) => node.uri === xsdNamespace && node.name === "include")
        .map((node) => node.attributes.schemaLocation),
      components: collectComponents(schema, name),
      rules: rules(schema, name),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const reference = documents.find(
    (document) => basename(document.path) === strictRoots[0],
  )!;
  const short = documents.find(
    (document) => basename(document.path) === strictRoots[1],
  )!;
  // ONIX tag aliases are declared by the corresponding global element tables.
  // Local particles can repeat names, so they deliberately reuse these aliases.
  const refElements = reference.components.filter(
    (entry) =>
      entry.kind === "element" && entry.scope === "global" && entry.name,
  );
  const shortElements = short.components.filter(
    (entry) =>
      entry.kind === "element" && entry.scope === "global" && entry.name,
  );
  if (refElements.length !== shortElements.length)
    throw new Error(
      "Reference and short schemas have different element counts.",
    );
  const aliases = refElements.map((entry, index) => ({
    reference: entry.name!,
    short: shortElements[index].name!,
  }));
  if (
    new Set(aliases.map((alias) => alias.reference)).size !== aliases.length ||
    new Set(aliases.map((alias) => alias.short)).size !== aliases.length
  )
    throw new Error("Reference/short aliases are not one-to-one.");
  const manifest = {
    onixRelease: "3.1.3",
    schemaVersion: "3.1.3.74.0",
    codelistIssue: 74,
    canonicalRoots: strictRoots.map(
      (name) =>
        `data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74/${name}`,
    ),
    includedModules: [
      "ONIX_BookProduct_CodeLists.xsd",
      "ONIX_XHTML_Subset.xsd",
    ],
    samples: names.filter((name) => name.endsWith(".xml")),
    legacyInputs: names
      .filter((name) =>
        /^ONIX_BookProduct_3.1_(reference|short)\.xsd$/.test(name),
      )
      .concat(["scripts/switch-onix-3.0-tagnames-2.0_v1.3.xsl"]),
    files: sourceFiles,
  };
  const ir = {
    format: "onix-engine.schema-ir/v1",
    ...manifest,
    manifest,
    documents,
    aliases,
  };
  await mkdir(generatedDirectory, { recursive: true });
  await mkdir(sourceDirectory, { recursive: true });
  const json = `${JSON.stringify(ir, null, 2)}\n`;
  await writeFile(resolve(generatedDirectory, "onix-3.1.3-schema.json"), json);
  await writeFile(
    resolve(generatedDirectory, "onix-3.1.3-source-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(sourceDirectory, "onix-3.1.3-schema.ts"),
    `// Generated by scripts/import-onix-schema.ts. Internal: not exported from the package root.\nimport schema from "../../data/generated/onix-3.1.3-schema.json" with { type: "json" };\nimport type { OnixSchema } from "../internal/onix-schema.js";\nexport const onix313Schema = schema as OnixSchema;\n`,
  );
  console.log(
    `Generated ONIX 3.1.3 schema IR from ${documents.length} schemas and ${aliases.length} aliases.`,
  );
}
await main();
