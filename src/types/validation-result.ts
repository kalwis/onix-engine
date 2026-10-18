export interface ValidationError {
  readonly message: string;
  readonly line?: number;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly schemaVersion: "3.1.3.1";
  readonly tags?: "reference" | "short";
}
