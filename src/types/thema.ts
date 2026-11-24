export interface ThemaEntry {
  readonly code: string;
  readonly heading: string;
  readonly parentCode?: string;
  readonly note?: string;
}

export interface ThemaMetadata {
  readonly issue: number;
  readonly version: string;
  readonly lastUpdated: string;
}
