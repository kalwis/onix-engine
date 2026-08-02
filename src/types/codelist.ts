export interface CodelistEntry {
  readonly code: string;
  readonly heading: string;
}

export interface Codelist {
  readonly number: number;
  readonly heading: string;
  readonly entries: readonly CodelistEntry[];
}
