/** Canonical, reference-name ONIX value. Repeated particles are arrays. */
export type OnixValue = string | OnixNode;

export interface OnixNode {
  readonly $attributes?: Readonly<Record<string, string>>;
  readonly $value?: string;
  readonly [element: string]: OnixValue | readonly OnixValue[] | Readonly<Record<string, string>> | undefined;
}

/** Contents of the ONIXMessage root element, using lower-camel reference names. */
export type OnixMessage = OnixNode;

export interface OnixXmlOptions {
  readonly tags?: "reference" | "short";
  readonly declaration?: boolean;
}

export interface OnixParseResult {
  readonly message?: OnixMessage;
  readonly report: import("./validation.js").OnixXmlValidationReport;
}
