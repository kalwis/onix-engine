/** An XHTML element within an ONIX field that permits formatted content. */
export interface OnixInlineElement {
  readonly name: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly content?: readonly (string | OnixInlineElement)[];
}

export type OnixValue = string | OnixNode;

/** Canonical reference-tag names, written as lower-camel properties. */
export interface OnixNode {
  readonly $attributes?: Readonly<Record<string, string>>;
  readonly $value?: string;
  readonly $content?: readonly (string | OnixInlineElement)[];
  readonly [element: string]:
    | OnixValue
    | readonly OnixValue[]
    | Readonly<Record<string, string>>
    | readonly (string | OnixInlineElement)[]
    | undefined;
}

export type OnixMessage = OnixNode;

export interface OnixXmlOptions {
  readonly tags?: "reference" | "short";
  readonly declaration?: boolean;
}

export interface ProductInput {
  readonly recordReference?: string;
  readonly notificationType?: string;
  readonly isbn?: string;
  readonly title?: string;
  readonly productComposition?: string;
  readonly productForm?: string;
}
