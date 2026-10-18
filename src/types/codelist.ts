export interface CodelistEntry {
  readonly code: string;
  readonly heading: string;
  readonly note?: string;
  readonly issueAdded?: string;
  readonly issueModified?: string;
  readonly issueDeprecated?: string;
}

export interface Codelist {
  readonly number: number;
  readonly heading: string;
  readonly entries: readonly CodelistEntry[];
}
