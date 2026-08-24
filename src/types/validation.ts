export type ValidationSeverity = "error" | "warning";

export interface SourceLocation {
  readonly line?: number;
  readonly column?: number;
  readonly xmlPath?: string;
  readonly productIndex?: number;
}

export interface ValidationSource {
  readonly type: "codelist-note" | "schematron" | "thema";
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

export interface OnixCodeInput {
  readonly productComposition?: string;
  readonly productForm?: string;
  readonly productFormDetails?: readonly string[];
  readonly subjects?: readonly OnixSubjectAssignment[];
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
