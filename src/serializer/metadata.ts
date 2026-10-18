import { onixConstruction } from "../generated/onix-construction.js";

export interface ConstructionElement {
  readonly short?: string;
  readonly children: readonly string[];
  readonly attributes: readonly string[];
}

const elements: Readonly<Record<string, ConstructionElement>> =
  onixConstruction;
export const aliasesByReference = new Map(
  Object.entries(elements).map(([name, value]) => [name, value.short]),
);

export function propertyName(reference: string): string {
  return reference.length
    ? `${reference[0]!.toLowerCase()}${reference.slice(1)}`
    : reference;
}

export function elementDefinition(
  reference: string,
): ConstructionElement | undefined {
  return elements[reference];
}
