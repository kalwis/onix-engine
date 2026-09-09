import { SaxesParser, type SaxesTag } from "saxes";
import { createValidationReport, validateOnixCodes } from "./validate-onix-codes.js";
import type { OnixCodeInput, OnixXmlValidationReport, SourceLocation, ValidateOnixXmlOptions, ValidationFinding } from "../types/validation.js";

type Product = { input: OnixCodeInput & { productFormDetails: string[]; subjects: { schemeCode: string; code: string; isMain?: boolean }[]; identifierGroups: { context: string; path: string; identifiers: { typeCode: string; value: string; typeName?: string }[] }[] }; locations: Map<string, SourceLocation>; subject?: { scheme?: string; code?: string; main?: boolean; locations: Map<string, SourceLocation> }; identifier?: { type?: string; value?: string; name?: string; locations: Map<string, SourceLocation> } };
type Stack = { name: string; path: string; counts: Map<string, number>; text: string };
const fields: Record<string, "productComposition" | "productForm" | "productFormDetails" | "scheme" | "code" | "main" | "idType" | "idName" | "idValue"> = {
  ProductComposition: "productComposition", x314: "productComposition", ProductForm: "productForm", b012: "productForm", b013: "productForm", ProductFormDetail: "productFormDetails", b333: "productFormDetails", SubjectSchemeIdentifier: "scheme", b067: "scheme", SubjectCode: "code", b069: "code", MainSubject: "main", x425: "main", ProductIDType: "idType", b221: "idType", IDTypeName: "idName", b233: "idName", IDValue: "idValue", b244: "idValue",
};
function attrs(tag: SaxesTag): Record<string, string> { return Object.fromEntries(Object.entries(tag.attributes).map(([key, value]) => [key, typeof value === "string" ? value : value.value])); }

/**
 * XML validation adapter retaining field locations for the existing codelist
 * API. Structural validation is available through parseOnixXml and
 * validateOnixMessage; this adapter adds the reviewed semantic findings.
 */
export function validateOnixXml(xml: string, options: ValidateOnixXmlOptions = {}): OnixXmlValidationReport {
  const products: Product[] = [];
  const stack: Stack[] = [];
  let root: string | undefined;
  let release: string | undefined;
  let product: Product | undefined;
  let malformedXml: OnixXmlValidationReport["malformedXml"];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("opentag", (tag: SaxesTag) => {
    const name = tag.local || tag.name;
    const parent = stack.at(-1);
    const count = (parent?.counts.get(name) ?? 0) + 1;
    parent?.counts.set(name, count);
    stack.push({ name, path: `${parent?.path ?? ""}/${name}[${count}]`, counts: new Map(), text: "" });
    if (!root) { root = name; release = attrs(tag).release; }
    if (name === "Product" || name === "product") product = { input: { productFormDetails: [], subjects: [], identifierGroups: [] }, locations: new Map() };
    if (product && (name === "Subject" || name === "subject")) product.subject = { locations: new Map() };
    if (product && (name === "ProductIdentifier" || name === "productidentifier")) product.identifier = { locations: new Map() };
  });
  parser.on("text", (text: string) => { if (stack.length) stack.at(-1)!.text += text; });
  parser.on("closetag", () => {
    const node = stack.pop();
    if (!node || !product) return;
    const value = node.text.trim();
    const location: SourceLocation = { line: parser.line + 1, column: parser.column + 1, xmlPath: node.path, productIndex: products.length };
    const field = fields[node.name];
    if (field && value) {
      if (field === "productComposition" || field === "productForm") { (product.input as { productComposition?: string; productForm?: string })[field] = value; product.locations.set(`/${field}`, location); }
      else if (field === "productFormDetails") { const index = product.input.productFormDetails.length; product.input.productFormDetails.push(value); product.locations.set(`/productFormDetails/${index}`, location); }
      else if (product.subject && field === "scheme") { product.subject.scheme = value; product.subject.locations.set("schemeCode", location); }
      else if (product.subject && field === "code") { product.subject.code = value; product.subject.locations.set("code", location); }
      else if (product.subject && field === "main") { product.subject.main = value === "01" || value.toLowerCase() === "true"; product.subject.locations.set("isMain", location); }
      else if (product.identifier && field === "idType") { product.identifier.type = value; product.identifier.locations.set("typeCode", location); }
      else if (product.identifier && field === "idName") { product.identifier.name = value; product.identifier.locations.set("typeName", location); }
      else if (product.identifier && field === "idValue") { product.identifier.value = value; product.identifier.locations.set("value", location); }
    }
    if ((node.name === "Subject" || node.name === "subject") && product.subject) {
      const subject = product.subject;
      if (subject.scheme && subject.code) { const index = product.input.subjects.length; product.input.subjects.push({ schemeCode: subject.scheme, code: subject.code, ...(subject.main ? { isMain: true } : {}) }); for (const [key, source] of subject.locations) product.locations.set(`/subjects/${index}/${key}`, source); }
      product.subject = undefined;
    }
    if ((node.name === "ProductIdentifier" || node.name === "productidentifier") && product.identifier) {
      const identifier = product.identifier;
      if (identifier.type && identifier.value) { const group = { context: "ProductIdentifier", path: `/identifierGroups/0`, identifiers: [{ typeCode: identifier.type, value: identifier.value, ...(identifier.name ? { typeName: identifier.name } : {}) }] }; product.input.identifierGroups.push(group); for (const [key, source] of identifier.locations) product.locations.set(`${group.path}/0/${key}`, source); }
      product.identifier = undefined;
    }
    if (node.name === "Product" || node.name === "product") { products.push(product); product = undefined; }
  });
  parser.on("error", (error: Error) => { malformedXml = { message: error.message, line: parser.line + 1, column: parser.column + 1 }; });
  try { parser.write(xml).close(); } catch (error) { malformedXml ??= { message: error instanceof Error ? error.message : "Invalid XML" }; }
  if (malformedXml) return { ...createValidationReport([]), malformedXml };
  if ((root !== "ONIXMessage" && root !== "ONIXmessage") || !release?.startsWith("3.1")) return { ...createValidationReport([]), unsupportedMessage: { root, release, message: "Expected an ONIX 3.1 reference- or short-tag message." } };
  const findings: ValidationFinding[] = [];
  for (const [index, current] of products.entries()) for (const item of validateOnixCodes(current.input, options).findings) findings.push({ ...item, path: `/products/${index}${item.path}`, sourceLocation: current.locations.get(item.path) ?? { productIndex: index, xmlPath: `/Product[${index + 1}]` } });
  return createValidationReport(findings);
}
