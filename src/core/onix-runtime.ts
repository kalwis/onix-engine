import { onix313Schema } from "../generated/onix-3.1.3-schema.js";
import type { OnixElementDefinition, OnixParticle } from "../internal/onix-schema.js";

export const schemaElements = onix313Schema.elements ?? {};
export const aliasesByReference = new Map(onix313Schema.aliases.map((entry) => [entry.reference, entry.short]));
export const aliasesByShort = new Map(onix313Schema.aliases.map((entry) => [entry.short, entry.reference]));

export function propertyName(reference: string): string {
  return reference.length ? `${reference[0]!.toLowerCase()}${reference.slice(1)}` : reference;
}

export const referenceByProperty = new Map(
  Object.keys(schemaElements).map((reference) => [propertyName(reference), reference]),
);

export function elementDefinition(reference: string): OnixElementDefinition | undefined {
  return schemaElements[reference];
}

export function particles(particle: OnixParticle): readonly OnixParticle[] {
  return particle.kind === "element" || particle.kind === "any" ? [particle] : particle.children ?? [];
}

export function directElements(particle: OnixParticle): readonly OnixParticle[] {
  if (particle.kind === "element" || particle.kind === "any") return [particle];
  return (particle.children ?? []).flatMap(directElements);
}

export function expectedElements(definition: OnixElementDefinition): readonly OnixParticle[] {
  const seen = new Set<string>();
  return definition.particles
    .flatMap(directElements)
    .filter((particle) => !particle.name || (seen.has(particle.name) ? false : (seen.add(particle.name), true)));
}
