export interface SubjectVocabularyEntry {
  readonly code: string;
  readonly heading: string;
  readonly parentCode?: string;
  readonly note?: string;
}

export interface SubjectVocabularyMetadata {
  readonly onixSchemeCode: string;
  readonly name: string;
  readonly version: string;
}

export interface SubjectVocabularyDocument extends SubjectVocabularyMetadata {
  readonly entries: readonly SubjectVocabularyEntry[];
}

export interface SubjectVocabulary {
  readonly metadata: SubjectVocabularyMetadata;
  getEntries(): readonly SubjectVocabularyEntry[];
  getEntry(code: string): SubjectVocabularyEntry | undefined;
  getHeading(code: string): string | undefined;
  hasCode(code: string): boolean;
  getChildren(parentCode?: string): readonly SubjectVocabularyEntry[];
}
