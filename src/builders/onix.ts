import type { OnixMessage, OnixNode, OnixValue } from "../types/onix.js";

function clone(value: OnixValue): OnixValue {
  if (typeof value === "string") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, Array.isArray(child) ? child.map(clone) : child && typeof child === "object" && key !== "$attributes" ? clone(child as OnixValue) : child])) as OnixNode;
}

/** A small immutable schema-shaped builder. Generic operations make every generated particle reachable. */
export class OnixBuilder<T extends OnixNode = OnixMessage> {
  protected readonly value: T;
  constructor(value: T = {} as T) { this.value = clone(value) as T; }
  set(name: string, value: OnixValue): this {
    (this.value as Record<string, unknown>)[name] = value;
    return this;
  }
  append(name: string, value: OnixValue): this {
    const target = this.value as Record<string, unknown>;
    const current = target[name];
    target[name] = current === undefined ? [value] : Array.isArray(current) ? [...current, value] : [current as OnixValue, value];
    return this;
  }
  build(): T { return clone(this.value) as T; }
}

export class ProductBuilder extends OnixBuilder<OnixNode> {
  identifier(typeCode: string, value: string, typeName?: string): this {
    return this.append("productIdentifier", {
      productIDType: typeCode,
      ...(typeName ? { iDTypeName: typeName } : {}),
      iDValue: value,
    });
  }

  private appendDescriptive(name: string, value: OnixValue): this {
    const current = this.value.descriptiveDetail;
    const descriptive =
      current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as OnixNode) }
        : ({} as OnixNode);
    const existing = descriptive[name];
    (descriptive as Record<string, unknown>)[name] =
      existing === undefined ? [value] : Array.isArray(existing) ? [...existing, value] : [existing as OnixValue, value];
    return this.set("descriptiveDetail", descriptive);
  }

  title(typeCode: string, text: string): this {
    return this.appendDescriptive("titleDetail", {
      titleType: typeCode,
      titleElement: [{ titleElementLevel: "01", titleText: text }],
    });
  }
  contributor(roleCode: string, name: string): this {
    return this.appendDescriptive("contributor", { contributorRole: [roleCode], personName: name });
  }
  subject(schemeCode: string, code: string, isMain = false): this {
    return this.appendDescriptive("subject", {
      subjectSchemeIdentifier: schemeCode,
      subjectCode: code,
      ...(isMain ? { mainSubject: "01" } : {}),
    });
  }
}

export class OnixMessageBuilder extends OnixBuilder<OnixMessage> {
  /** Supply sender and other header fields from the calling application's organization data. */
  header(value: OnixNode): this { return this.set("header", value); }
  product(configure: ProductBuilder | ((product: ProductBuilder) => ProductBuilder)): this {
    const product = configure instanceof ProductBuilder ? configure : configure(new ProductBuilder());
    return this.append("product", product.build());
  }
}

export function createOnixMessage(value?: OnixMessage): OnixMessageBuilder { return new OnixMessageBuilder(value); }
export function createProduct(value?: OnixNode): ProductBuilder { return new ProductBuilder(value); }
