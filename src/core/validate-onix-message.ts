import { createValidationReport } from "./validate-onix-codes.js";
import { validateOnixCodes } from "./validate-onix-codes.js";
import { elementDefinition, propertyName } from "./onix-runtime.js";
import type { OnixParticle } from "../internal/onix-schema.js";
import type { OnixMessage, OnixNode, OnixValue } from "../types/onix.js";
import type { ValidationFinding } from "../types/validation.js";

function finding(ruleId: string, path: string, parameters: Record<string, string | number | boolean | readonly string[]>): ValidationFinding {
  return { ruleId, severity: "error", path, parameters, source: { type: "schema", rule: ruleId } };
}
function values(value: unknown): readonly OnixValue[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as readonly OnixValue[];
  return [value as OnixValue];
}
function elementNames(particle: OnixParticle): readonly string[] {
  if (particle.kind === "element") return particle.name ? [particle.name] : [];
  return (particle.children ?? []).flatMap(elementNames);
}
function particleHasValue(particle: OnixParticle, node: OnixNode): boolean {
  return elementNames(particle).some((name) => node[propertyName(name)] !== undefined);
}
function requiredMissing(particle: OnixParticle, node: OnixNode): number {
  if (particle.kind === "element") return particle.name && values(node[propertyName(particle.name)]).length < particle.minOccurs ? 1 : 0;
  if (particle.kind === "any") return 0;
  const children = particle.children ?? [];
  if (particle.kind === "choice") return particle.minOccurs === 0 ? 0 : Math.min(...children.map((child) => requiredMissing(child, node)), 1);
  if (particle.minOccurs === 0 && !children.some((child) => particleHasValue(child, node))) return 0;
  return children.reduce((total, child) => total + requiredMissing(child, node), 0);
}
function validateParticle(particle: OnixParticle, node: OnixNode, path: string, findings: ValidationFinding[]): void {
  if (particle.kind === "element") {
    if (!particle.name) return;
    const key = propertyName(particle.name);
    const entries = values(node[key]);
    if (entries.length < particle.minOccurs) findings.push(finding("ONIX-MIN-OCCURS", `${path}/${key}`, { element: particle.name, minOccurs: particle.minOccurs }));
    if (particle.maxOccurs !== null && entries.length > particle.maxOccurs) findings.push(finding("ONIX-MAX-OCCURS", `${path}/${key}`, { element: particle.name, maxOccurs: particle.maxOccurs }));
    entries.forEach((entry, index) => validateElement(particle.name!, entry, `${path}/${key}${entries.length > 1 ? `/${index}` : ""}`, findings));
    return;
  }
  if (particle.kind === "any") return;
  const children = particle.children ?? [];
  const active = children.filter((child) => particleHasValue(child, node));
  if (particle.kind === "choice") {
    // XSD branches may share optional particles. Choose the branch with the
    // fewest missing mandatory leaves rather than treating overlap as two
    // simultaneous choices.
    const selected = active.sort((a, b) => requiredMissing(a, node) - requiredMissing(b, node))[0];
    if (selected) validateParticle(selected, node, path, findings);
    return;
  }
  if (!active.length && particle.minOccurs === 0) return;
  for (const child of children) validateParticle(child, node, path, findings);
}
function validateElement(reference: string, value: OnixValue, path: string, findings: ValidationFinding[]): void {
  const definition = elementDefinition(reference);
  if (!definition || typeof value === "string") return;
  const node = value as OnixNode;
  const expected = definition.particles.flatMap(elementNames);
  const expectedByProperty = new Map(expected.map((name, order) => [propertyName(name), order]));
  let lastOrder = -1;
  for (const key of Object.keys(node)) {
    if (key === "$attributes" || key === "$value") continue;
    const order = expectedByProperty.get(key);
    if (order === undefined) findings.push(finding("ONIX-UNKNOWN-ELEMENT", `${path}/${key}`, { parent: reference, property: key }));
    else if (order < lastOrder) findings.push(finding("ONIX-SEQUENCE", `${path}/${key}`, { element: key }));
    else lastOrder = order;
  }
  for (const particle of definition.particles) validateParticle(particle, node, path, findings);
  for (const attribute of definition.attributes) if (attribute.use === "required" && !node.$attributes?.[attribute.name]) findings.push(finding("ONIX-REQUIRED-ATTRIBUTE", `${path}/$attributes/${attribute.name}`, { element: reference, attribute: attribute.name }));
}

/** Structural validation for canonical ONIX models. */
export function validateOnixMessage(message: OnixMessage) {
  const findings: ValidationFinding[] = [];
  validateElement("ONIXMessage", message, "", findings);
  const products = values(message.product);
  for (const [index, product] of products.entries()) {
    if (typeof product === "string") continue;
    const descriptive = product.descriptiveDetail as OnixNode | undefined;
    const subjects = values(descriptive?.subject).flatMap((subject) => {
      if (typeof subject === "string") return [];
      const schemeCode = subject.subjectSchemeIdentifier;
      const code = subject.subjectCode;
      return typeof schemeCode === "string" && typeof code === "string"
        ? [{ schemeCode, code, ...(subject.mainSubject === "01" ? { isMain: true } : {}) }]
        : [];
    });
    const productFormDetails = values(descriptive?.productFormDetail).filter((value): value is string => typeof value === "string");
    const report = validateOnixCodes({
      ...(typeof descriptive?.productComposition === "string" ? { productComposition: descriptive.productComposition } : {}),
      ...(typeof descriptive?.productForm === "string" ? { productForm: descriptive.productForm } : {}),
      ...(productFormDetails.length ? { productFormDetails } : {}),
      ...(subjects.length ? { subjects } : {}),
    });
    for (const item of report.findings) findings.push({ ...item, path: `/product${products.length > 1 ? `/${index}` : ""}${item.path}` });
  }
  return createValidationReport(findings);
}
