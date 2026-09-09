/** Internal representation of the imported EDItEUR ONIX schema. */
export type Occurrence = {
  readonly minOccurs: string;
  readonly maxOccurs: string;
};

export type ContentNode = Occurrence & {
  readonly kind: "sequence" | "choice" | "all" | "element" | "group" | "any";
  readonly name?: string;
  readonly ref?: string;
  readonly children?: readonly ContentNode[];
};

export type SchemaComponent = {
  readonly id: string;
  readonly kind: string;
  readonly name?: string;
  readonly scope: "global" | "local";
  readonly source: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly content: readonly ContentNode[];
  readonly facets?: readonly {
    readonly kind: string;
    readonly value?: string;
    readonly fixed?: string;
  }[];
  readonly derivation?: {
    readonly kind: "extension" | "restriction";
    readonly base?: string;
  };
};

export type OnixSchema = {
  readonly format: "onix-engine.schema-ir/v1";
  readonly onixRelease: string;
  readonly schemaVersion: string;
  readonly codelistIssue: number;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly documents: readonly {
    readonly path: string;
    readonly namespace?: string;
    readonly version?: string;
    readonly includes: readonly string[];
    readonly components: readonly SchemaComponent[];
    readonly rules: readonly unknown[];
  }[];
  readonly aliases: readonly {
    readonly reference: string;
    readonly short: string;
  }[];
  /**
   * Resolved structural view of the reference-tag schema. This is deliberately
   * particle based: an element can occur in different cardinality/choice
   * contexts, so cardinality does not belong to the global declaration.
   */
  readonly elements?: Readonly<Record<string, OnixElementDefinition>>;
};

export type OnixOccurrence = {
  readonly minOccurs: number;
  readonly maxOccurs: number | null;
};

export type OnixParticle = OnixOccurrence & {
  readonly kind: "element" | "sequence" | "choice" | "all" | "any";
  readonly name?: string;
  readonly children?: readonly OnixParticle[];
};

export type OnixAttributeDefinition = OnixOccurrence & {
  readonly name: string;
  readonly type?: string;
  readonly use?: "optional" | "required" | "prohibited";
};

export type OnixElementDefinition = {
  readonly name: string;
  readonly shortName?: string;
  readonly type?: string;
  readonly particles: readonly OnixParticle[];
  readonly attributes: readonly OnixAttributeDefinition[];
  readonly simple: boolean;
};
