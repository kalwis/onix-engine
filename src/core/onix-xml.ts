import { SaxesParser, type SaxesTag } from "saxes";
import { aliasesByReference, aliasesByShort, elementDefinition, expectedElements, propertyName } from "./onix-runtime.js";
import type { OnixMessage, OnixNode, OnixParseResult, OnixValue, OnixXmlOptions } from "../types/onix.js";
import { validateOnixMessage } from "./validate-onix-message.js";
import { createValidationReport } from "./validate-onix-codes.js";

type XmlNode = { name: string; attributes: Record<string, string>; text: string; children: XmlNode[] };

function tagAttributes(tag: SaxesTag): Record<string, string> {
  return Object.fromEntries(Object.entries(tag.attributes).map(([name, value]) => [name, typeof value === "string" ? value : value.value]));
}
function referenceName(name: string): string { return aliasesByShort.get(name) ?? name; }
function append(target: Record<string, unknown>, key: string, value: OnixValue): void {
  const current = target[key];
  target[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current as OnixValue, value];
}
function canonical(node: XmlNode): OnixValue {
  const reference = referenceName(node.name);
  const definition = elementDefinition(reference);
  const attributes = Object.fromEntries(Object.entries(node.attributes).filter(([name]) => !["refname", "shortname"].includes(name)));
  if (definition?.simple || node.children.length === 0) {
    if (Object.keys(attributes).length) return { $attributes: attributes, $value: node.text.trim() };
    return node.text.trim();
  }
  const result: Record<string, unknown> = Object.keys(attributes).length ? { $attributes: attributes } : {};
  for (const child of node.children) append(result, propertyName(referenceName(child.name)), canonical(child));
  if (node.text.trim()) result.$value = node.text.trim();
  return result as OnixNode;
}

/** Parse either official tag representation into the canonical reference-name model. */
export function parseOnixXml(xml: string): OnixParseResult {
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let malformed: { message: string; line?: number; column?: number } | undefined;
  const parser = new SaxesParser({ xmlns: true });
  parser.on("opentag", (tag: SaxesTag) => {
    const node: XmlNode = { name: tag.local || tag.name, attributes: tagAttributes(tag), text: "", children: [] };
    if (stack.length) stack.at(-1)!.children.push(node); else root = node;
    stack.push(node);
  });
  parser.on("text", (text: string) => { if (stack.length) stack.at(-1)!.text += text; });
  parser.on("closetag", () => { stack.pop(); });
  parser.on("error", (error: Error) => { malformed = { message: error.message, line: parser.line + 1, column: parser.column + 1 }; });
  try { parser.write(xml).close(); } catch (error) { malformed ??= { message: error instanceof Error ? error.message : "Invalid XML" }; }
  if (malformed || !root) return { report: { ...createValidationReport([]), malformedXml: malformed ?? { message: "No document element" } } };
  const reference = referenceName(root.name);
  if (reference !== "ONIXMessage") return { report: { ...createValidationReport([]), unsupportedMessage: { root: root.name, message: "Expected an ONIX 3.1 reference- or short-tag message." } } };
  const message = canonical(root) as OnixMessage;
  return { message, report: validateOnixMessage(message) };
}

const REFERENCE_NS = "http://ns.editeur.org/onix/3.1/reference";
const SHORT_NS = "http://ns.editeur.org/onix/3.1/short";

function escapeText(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function escapeAttribute(value: string): string { return escapeText(value).replaceAll('"', "&quot;"); }
function write(reference: string, value: OnixValue, tags: "reference" | "short"): string {
  const name = tags === "short" ? aliasesByReference.get(reference) : undefined;
  const tag = name ?? (tags === "short" ? undefined : reference);
  if (!tag) throw new Error(`No short-tag mapping for ${reference}.`);
  const node = typeof value === "string" ? undefined : value;
  const attributes = node?.$attributes ? Object.entries(node.$attributes).map(([key, attribute]) => ` ${key}="${escapeAttribute(attribute)}"`).join("") : "";
  if (typeof value === "string") return value === "" ? `<${tag}${attributes}/>` : `<${tag}${attributes}>${escapeText(value)}</${tag}>`;
  const definition = elementDefinition(reference);
  const body: string[] = [];
  for (const particle of expectedElements(definition ?? { particles: [] } as never)) {
    if (!particle.name) continue;
    const property = propertyName(particle.name);
    const child = node?.[property] as OnixValue | readonly OnixValue[] | undefined;
    for (const item of Array.isArray(child) ? child : child === undefined ? [] : [child]) body.push(write(particle.name, item, tags));
  }
  if (node?.$value) body.unshift(escapeText(node.$value));
  return body.length ? `<${tag}${attributes}>${body.join("")}</${tag}>` : `<${tag}${attributes}/>`;
}

function withMessageDefaults(message: OnixMessage, tags: "reference" | "short"): OnixMessage {
  const attributes = { ...(message.$attributes ?? {}) };
  if (attributes.release === undefined) attributes.release = "3.1";
  if (attributes.xmlns === undefined) attributes.xmlns = tags === "short" ? SHORT_NS : REFERENCE_NS;
  return { ...message, $attributes: attributes };
}

/** Serialize a canonical ONIX message in deterministic XSD particle order. */
export function serializeOnixXml(message: OnixMessage, options: OnixXmlOptions = {}): string {
  const tags = options.tags ?? "reference";
  const xml = write("ONIXMessage", withMessageDefaults(message, tags), tags);
  return options.declaration === false ? xml : `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}
