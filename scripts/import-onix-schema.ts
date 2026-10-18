/** Generate the small construction index from the pinned ONIX 3.1.3 XSDs. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { SaxesParser, type SaxesTag } from "saxes";

const root = resolve(import.meta.dirname, "..");
const rawDirectory = resolve(
  root,
  "data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74",
);
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
type NormalizedParticle = {
  kind: "element" | "sequence" | "choice" | "all" | "any";
  minOccurs: number;
  maxOccurs: number | null;
  name?: string;
  children?: NormalizedParticle[];
};
type NormalizedElement = {
  name: string;
  shortName?: string;
  type?: string;
  particles: NormalizedParticle[];
  attributes: {
    name: string;
    type?: string;
    use?: "optional" | "required" | "prohibited";
    minOccurs: number;
    maxOccurs: number | null;
  }[];
  simple: boolean;
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

function occurrence(node: Node): Pick<ContentNode, "minOccurs" | "maxOccurs"> {
  return {
    minOccurs: node.attributes.minOccurs ?? "1",
    maxOccurs: node.attributes.maxOccurs ?? "1",
  };
}
function normalizedOccurrence(node: Node): {
  minOccurs: number;
  maxOccurs: number | null;
} {
  const minOccurs = Number(node.attributes.minOccurs ?? "1");
  const rawMax = node.attributes.maxOccurs ?? "1";
  return {
    minOccurs,
    maxOccurs: rawMax === "unbounded" ? null : Number(rawMax),
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

function xsdChildren(node: Node, names?: readonly string[]): Node[] {
  return node.children.filter(
    (child) =>
      child.uri === xsdNamespace && (!names || names.includes(child.name)),
  );
}

/** Resolve the structural grammar used at runtime without treating XSD files as
 * runtime modules. The compiler intentionally retains particles (rather than
 * flattening them) so choices and nested occurrence constraints survive. */
function normalizeReferenceSchema(
  schema: Node,
): Record<string, NormalizedElement> {
  const globalGroups = new Map(
    xsdChildren(schema, ["group"])
      .filter((node) => node.attributes.name)
      .map((node) => [node.attributes.name!, node]),
  );
  const globalAttributeGroups = new Map(
    xsdChildren(schema, ["attributeGroup"])
      .filter((node) => node.attributes.name)
      .map((node) => [node.attributes.name!, node]),
  );
  const particle = (
    node: Node,
    visiting = new Set<string>(),
  ): NormalizedParticle | undefined => {
    const occurrence = normalizedOccurrence(node);
    if (node.name === "element")
      return {
        kind: "element",
        ...occurrence,
        ...(node.attributes.ref || node.attributes.name
          ? { name: node.attributes.ref ?? node.attributes.name }
          : {}),
      };
    if (node.name === "any") return { kind: "any", ...occurrence };
    if (node.name === "group") {
      const reference = node.attributes.ref;
      const target = reference ? globalGroups.get(reference) : node;
      if (!target || (reference && visiting.has(reference))) return undefined;
      const next = new Set(visiting);
      if (reference) next.add(reference);
      const model = xsdChildren(target, ["sequence", "choice", "all"])[0];
      const resolved = model ? particle(model, next) : undefined;
      if (!resolved) return undefined;
      return {
        ...resolved,
        minOccurs: occurrence.minOccurs,
        maxOccurs: occurrence.maxOccurs,
      };
    }
    if (["sequence", "choice", "all"].includes(node.name))
      return {
        kind: node.name as "sequence" | "choice" | "all",
        ...occurrence,
        children: xsdChildren(node, [
          "element",
          "sequence",
          "choice",
          "all",
          "group",
          "any",
        ])
          .map((child) => particle(child, visiting))
          .filter((child): child is NormalizedParticle => Boolean(child)),
      };
    return undefined;
  };
  const attributes = (
    node: Node,
    seen = new Set<string>(),
  ): NormalizedElement["attributes"] =>
    xsdChildren(node, ["attribute", "attributeGroup"]).flatMap((child) => {
      if (child.name === "attribute") {
        const name = child.attributes.name ?? child.attributes.ref;
        return name
          ? [
              {
                name,
                ...(child.attributes.type
                  ? { type: child.attributes.type }
                  : {}),
                ...(child.attributes.use
                  ? {
                      use: child.attributes.use as
                        "optional" | "required" | "prohibited",
                    }
                  : {}),
                minOccurs: child.attributes.use === "required" ? 1 : 0,
                maxOccurs: 1,
              },
            ]
          : [];
      }
      const ref = child.attributes.ref;
      const target =
        ref && !seen.has(ref) ? globalAttributeGroups.get(ref) : undefined;
      if (!target) return [];
      const next = new Set(seen);
      next.add(ref!);
      return attributes(target, next);
    });
  return Object.fromEntries(
    xsdChildren(schema, ["element"])
      .filter((node) => node.attributes.name)
      .map((node) => {
        const complex = xsdChildren(node, ["complexType"])[0];
        const model =
          complex && xsdChildren(complex, ["sequence", "choice", "all"])[0];
        const particles = model ? [particle(model)!] : [];
        const attrs = complex ? attributes(complex) : [];
        const shortName = attrs.find(
          (attribute) => attribute.name === "shortname",
        );
        const shortValue = shortName
          ? descendants(complex!).find(
              (child) => child.name === "enumeration" && child.attributes.value,
            )?.attributes.value
          : undefined;
        return [
          node.attributes.name!,
          {
            name: node.attributes.name!,
            ...(shortValue ? { shortName: shortValue } : {}),
            ...(node.attributes.type ? { type: node.attributes.type } : {}),
            particles,
            attributes: attrs,
            simple: !complex || particles.length === 0,
          } satisfies NormalizedElement,
        ];
      }),
  );
}

async function main(): Promise<void> {
  const standardRoots = [
    "ONIX_BookProduct_3.1_reference.xsd",
    "ONIX_BookProduct_3.1_short.xsd",
  ];
  const parsed = new Map<string, Node>();
  for (const name of standardRoots)
    parsed.set(
      name,
      await parseXml(await readFile(resolve(rawDirectory, name), "utf8"), name),
    );
  const roots = standardRoots.map((name) => ({
    name,
    schema: parsed.get(name)!,
  }));
  for (const { name, schema } of roots) {
    if (schema.attributes.version !== "3.1.3.1")
      throw new Error(`${name} must declare schema version 3.1.3.1.`);
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
    (document) => basename(document.path) === standardRoots[0],
  )!;
  const short = documents.find(
    (document) => basename(document.path) === standardRoots[1],
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
  const normalizedElements = normalizeReferenceSchema(roots[0]!.schema);
  for (const alias of aliases) {
    const element = normalizedElements[alias.reference];
    if (element) element.shortName = alias.short;
  }
  const namesIn = (particle: NormalizedParticle): string[] =>
    particle.kind === "element"
      ? particle.name
        ? [particle.name]
        : []
      : (particle.children ?? []).flatMap(namesIn);
  const construction = Object.fromEntries(
    Object.entries(normalizedElements).map(([name, element]) => [
      name,
      {
        short: element.shortName,
        children: [...new Set(element.particles.flatMap(namesIn))],
        attributes: element.attributes.map((attribute) => attribute.name),
      },
    ]),
  );
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    resolve(sourceDirectory, "onix-construction.ts"),
    `// Generated from the official non-strict ONIX 3.1.3 XSDs. Do not edit.\nexport const onixConstruction = ${JSON.stringify(construction)} as const;\nexport const onixSchemaVersion = "3.1.3.1";\n`,
  );
  console.log(
    `Generated construction metadata for ${Object.keys(construction).length} ONIX elements and ${aliases.length} aliases.`,
  );
}
await main();
