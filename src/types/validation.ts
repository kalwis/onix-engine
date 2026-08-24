export type ValidationSeverity = "error" | "warning";

export interface SourceLocation {
  readonly line?: number;
  readonly column?: number;
  readonly xmlPath?: string;
  readonly productIndex?: number;
}

export interface ValidationSource {
  readonly type: "codelist-note" | "schematron" | "thema" | "schema";
  readonly list?: number;
  readonly code?: string;
  readonly text?: string;
  readonly rule?: string;
}

export interface ValidationFinding {
  readonly ruleId: string;
  readonly severity: ValidationSeverity;
  readonly path: string;
  readonly parameters: Readonly<
    Record<string, string | number | boolean | readonly string[]>
  >;
  readonly source: ValidationSource;
  readonly sourceLocation?: SourceLocation;
}

export interface OnixSubjectAssignment {
  readonly schemeCode: string;
  readonly code: string;
  readonly isMain?: boolean;
}

/** A repeatable ONIX <...Identifier> composite in one parent context. */
export interface OnixIdentifier {
  readonly typeCode: string;
  readonly value: string;
  readonly typeName?: string;
}

export interface OnixIdentifierGroup {
  /** Reference-tag composite name, eg ProductIdentifier. */
  readonly context: string;
  /** Canonical path for this repeated composite, eg /productIdentifiers. */
  readonly path: string;
  readonly identifiers: readonly OnixIdentifier[];
}

export interface OnixCodeInput {
  readonly productComposition?: string;
  readonly productForm?: string;
  readonly productFormDetails?: readonly string[];
  readonly subjects?: readonly OnixSubjectAssignment[];
  readonly identifierGroups?: readonly OnixIdentifierGroup[];
}

export interface ValidationVersions {
  readonly onixRelease: string;
  readonly codelistIssue: number;
  readonly themaVersion: string;
  readonly semanticRulesVersion: string;
}

export interface ValidationReport {
  readonly findings: readonly ValidationFinding[];
  readonly findingsByPath: Readonly<
    Record<string, readonly ValidationFinding[]>
  >;
  readonly versions: ValidationVersions;
}

export interface ValidationFieldReport {
  readonly path: string;
  readonly findings: readonly ValidationFinding[];
  readonly versions: ValidationVersions;
}

export interface ValidateOnixCodesOptions {
  readonly rejectAncestorDescendant?: boolean;
}

export type ValidateOnixXmlOptions = ValidateOnixCodesOptions;

export interface OnixXmlValidationReport extends ValidationReport {
  readonly malformedXml?: {
    readonly message: string;
    readonly line?: number;
    readonly column?: number;
  };
  readonly unsupportedMessage?: {
    readonly root?: string;
    readonly release?: string;
    readonly message: string;
  };
}

export interface SemanticManifestRule {
  readonly ruleId: string;
  readonly source: ValidationSource;
  readonly sourceClassification:
    "normative" | "recommendation" | "informational" | "unsupported";
  readonly enforcement: "error" | "warning" | "none";
  readonly predicate: Readonly<Record<string, unknown>>;
}

/** A lexical, non-enforcing candidate extracted from pinned Thema prose. */
export interface ThemaSemanticRuleAuditEntry {
  readonly code: string;
  readonly rawNote: string;
  readonly source: Readonly<{
    readonly type: "thema";
    readonly code: string;
    readonly version: string;
    readonly issue: number;
    readonly lastUpdated: string;
    readonly file: string;
  }>;
  readonly cue: "Use with" | "Prefer" | "See also" | "other";
  readonly referencedCodeLikeTokens: readonly string[];
  readonly classification: "unsupported-candidate";
}
