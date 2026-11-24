import type {
  OnixMessage,
  OnixNode,
  OnixValue,
  ProductInput,
} from "../types/onix.js";

function copy<T>(value: T): T {
  return structuredClone(value);
}

/** Common helpers plus generic ONIX reference-name fields. */
export class OnixBuilder<T extends OnixNode = OnixNode> {
  protected readonly value: Record<string, unknown>;

  constructor(value: T = {} as T) {
    this.value = copy(value) as Record<string, unknown>;
  }

  set(name: string, value: OnixValue): this {
    this.value[name] = copy(value);
    return this;
  }

  add(name: string, value: OnixValue): this {
    const current = this.value[name];
    this.value[name] =
      current === undefined
        ? [copy(value)]
        : Array.isArray(current)
          ? [...current, copy(value)]
          : [current, copy(value)];
    return this;
  }

  attributes(value: Readonly<Record<string, string>>): this {
    this.value.$attributes = {
      ...(this.value.$attributes as Record<string, string> | undefined),
      ...value,
    };
    return this;
  }

  build(): T {
    return copy(this.value) as T;
  }
}

export class ProductBuilder extends OnixBuilder<OnixNode> {
  identifier(typeCode: string, value: string, typeName?: string): this {
    return this.add("productIdentifier", {
      productIDType: typeCode,
      ...(typeName ? { iDTypeName: typeName } : {}),
      iDValue: value,
    });
  }

  private descriptive(name: string, value: OnixValue, repeated: boolean): this {
    const current = this.value.descriptiveDetail;
    const detail =
      current && typeof current === "object" && !Array.isArray(current)
        ? (copy(current) as Record<string, unknown>)
        : {};
    const existing = detail[name];
    detail[name] = repeated
      ? existing === undefined
        ? [value]
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value]
      : value;
    this.value.descriptiveDetail = detail;
    return this;
  }

  productForm(code: string): this {
    return this.descriptive("productForm", code, false);
  }
  productComposition(code: string): this {
    return this.descriptive("productComposition", code, false);
  }

  title(typeCode: string, text: string): this {
    return this.descriptive(
      "titleDetail",
      {
        titleType: typeCode,
        titleElement: [{ titleElementLevel: "01", titleText: text }],
      },
      true,
    );
  }

  contributor(roleCode: string, name: string): this {
    return this.descriptive(
      "contributor",
      { contributorRole: [roleCode], personName: name },
      true,
    );
  }

  subject(schemeCode: string, code: string, isMain = false): this {
    return this.descriptive(
      "subject",
      {
        subjectSchemeIdentifier: schemeCode,
        subjectCode: code,
        ...(isMain ? { mainSubject: "01" } : {}),
      },
      true,
    );
  }
}

export class OnixMessageBuilder extends OnixBuilder<OnixMessage> {
  header(value: OnixNode): this {
    return this.set("header", value);
  }

  product(
    configure: ProductBuilder | ((product: ProductBuilder) => ProductBuilder),
  ): this {
    const product =
      configure instanceof ProductBuilder
        ? configure
        : configure(new ProductBuilder());
    return this.add("product", product.build());
  }
}

export function createProduct(input: ProductInput = {}): ProductBuilder {
  const product = new ProductBuilder();
  if (input.recordReference !== undefined)
    product.set("recordReference", input.recordReference);
  if (input.notificationType !== undefined)
    product.set("notificationType", input.notificationType);
  if (input.isbn !== undefined) product.identifier("15", input.isbn);
  if (input.title !== undefined) product.title("01", input.title);
  if (input.productComposition !== undefined)
    product.productComposition(input.productComposition);
  if (input.productForm !== undefined) product.productForm(input.productForm);
  return product;
}

export function createOnixMessage(): OnixMessageBuilder {
  return new OnixMessageBuilder();
}
