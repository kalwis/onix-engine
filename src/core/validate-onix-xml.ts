import { SaxesParser, type SaxesTag } from "saxes";
import {
  createValidationReport,
  validateOnixCodes,
} from "./validate-onix-codes.js";
import { identifierContextRegistry } from "../generated/semantic-manifest.js";
import type {
  OnixCodeInput,
  OnixXmlValidationReport,
  SourceLocation,
  ValidateOnixXmlOptions,
  ValidationFinding,
} from "../types/validation.js";

const names: Record<
  string,
  keyof OnixCodeInput | "subjectScheme" | "subjectCode" | "subjectMain"
> = {
  ProductComposition: "productComposition",
  b012: "productComposition",
  ProductForm: "productForm",
  b013: "productForm",
  ProductFormDetail: "productFormDetails",
  b333: "productFormDetails",
  SubjectSchemeIdentifier: "subjectScheme",
  b067: "subjectScheme",
  SubjectCode: "subjectCode",
  b069: "subjectCode",
  MainSubject: "subjectMain",
  x425: "subjectMain",
};

interface ProductState {
  input: {
    productFormDetails: string[];
    subjects: { schemeCode: string; code: string; isMain?: boolean }[];
    productComposition?: string;
    productForm?: string;
    identifierGroups: {
      context: string;
      path: string;
      identifiers: { typeCode: string; value: string; typeName?: string }[];
    }[];
  };
  locations: Map<string, SourceLocation>;
  subject?: {
    schemeCode?: string;
    code?: string;
    isMain?: boolean;
    locations: Map<string, SourceLocation>;
  };
  identifier?: {
    context: string;
    path: string;
    parentPath: string;
    typeCode?: string;
    value?: string;
    typeName?: string;
    locations: Map<string, SourceLocation>;
  };
}
interface StackNode {
  local: string;
  path: string;
  counts: Map<string, number>;
  text: string;
}

function tagName(tag: SaxesTag): string {
  return tag.local || tag.name;
}
function attributes(tag: SaxesTag): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tag.attributes).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value.value,
    ]),
  );
}

/** Parses only the fields consumed by validateOnixCodes; this is not XSD validation. */
export function validateOnixXml(
  xml: string,
  options: ValidateOnixXmlOptions = {},
): OnixXmlValidationReport {
  const products: ProductState[] = [];
  const stack: StackNode[] = [];
  let root: string | undefined;
  let release: string | undefined;
  let product: ProductState | undefined;
  let parseError:
    { message: string; line?: number; column?: number } | undefined;
  const parser = new SaxesParser({ xmlns: true });
  parser.on("opentag", (tag: SaxesTag) => {
    const local = tagName(tag);
    const parent = stack.at(-1);
    const occurrence = (parent?.counts.get(local) ?? 0) + 1;
    parent?.counts.set(local, occurrence);
    const path = `${parent?.path ?? ""}/${local}[${occurrence}]`;
    stack.push({ local, path, counts: new Map(), text: "" });
    if (!root) {
      root = local;
      release = attributes(tag).release;
    }
    if (local === "Product" || local === "product")
      product = {
        input: { productFormDetails: [], subjects: [], identifierGroups: [] },
        locations: new Map(),
      };
    if (product && (local === "Subject" || local === "subject"))
      product.subject = { locations: new Map() };
    if (product) {
      const context = identifierContextRegistry.find(
        (entry) => entry.context === local || entry.shortName === local,
      );
      if (context)
        product.identifier = {
          context: context.context,
          path,
          parentPath: parent?.path ?? "",
          locations: new Map(),
        };
    }
  });
  parser.on("text", (value: string) => {
    const node = stack.at(-1);
    if (!product || !node) return;
    node.text += value;
  });
  parser.on("closetag", () => {
    const node = stack.pop();
    if (!node || !product) return;
    const key = names[node.local];
    const text = node.text.trim();
    if (key && text) {
      const location: SourceLocation = {
        line: parser.line + 1,
        column: parser.column + 1,
        xmlPath: node.path,
        productIndex: products.length,
      };
      if (key === "productComposition" || key === "productForm") {
        product.input[key] = text;
        product.locations.set(`/${key}`, location);
      } else if (key === "productFormDetails") {
        const index = product.input.productFormDetails.length;
        product.input.productFormDetails.push(text);
        product.locations.set(`/productFormDetails/${index}`, location);
      } else if (product.subject) {
        if (key === "subjectScheme") {
          product.subject.schemeCode = text;
          product.subject.locations.set("schemeCode", location);
        }
        if (key === "subjectCode") {
          product.subject.code = text;
          product.subject.locations.set("code", location);
        }
        if (key === "subjectMain") {
          product.subject.isMain =
            text === "01" || text.toLowerCase() === "true";
          product.subject.locations.set("isMain", location);
        }
      }
    }
    if (product.identifier && text) {
      const context = identifierContextRegistry.find(
        (entry) => entry.context === product?.identifier?.context,
      );
      const location: SourceLocation = {
        line: parser.line + 1,
        column: parser.column + 1,
        xmlPath: node.path,
        productIndex: products.length,
      };
      if (
        node.local === context?.typeName ||
        node.local === context?.typeShortName
      ) {
        product.identifier.typeCode = text;
        product.identifier.locations.set("typeCode", location);
      } else if (node.local === "IDTypeName" || node.local === "b233") {
        product.identifier.typeName = text;
        product.identifier.locations.set("typeName", location);
      } else if (node.local === "IDValue" || node.local === "b244") {
        product.identifier.value = text;
        product.identifier.locations.set("value", location);
      }
    }
    if (
      (node.local === "Subject" || node.local === "subject") &&
      product.subject
    ) {
      const subject = product.subject;
      if (subject.schemeCode !== undefined && subject.code !== undefined) {
        const index = product.input.subjects.length;
        product.input.subjects.push({
          schemeCode: subject.schemeCode,
          code: subject.code,
          ...(subject.isMain ? { isMain: true } : {}),
        });
        for (const [field, location] of subject.locations)
          product.locations.set(`/subjects/${index}/${field}`, location);
      }
      product.subject = undefined;
    }
    if (
      product.identifier &&
      (node.local === product.identifier.context ||
        identifierContextRegistry.find(
          (entry) => entry.context === product?.identifier?.context,
        )?.shortName === node.local)
    ) {
      const identifier = product.identifier;
      if (identifier.typeCode !== undefined && identifier.value !== undefined) {
        const groupPath = `/identifierGroups/${product.input.identifierGroups.length}`;
        // A parent may repeat one identifier context; preserve that repetition
        // as a single validation group so tuple uniqueness is meaningful.
        let group = product.input.identifierGroups.find(
          (candidate) =>
            candidate.context === identifier.context &&
            candidate.path.endsWith(`:${identifier.parentPath}`),
        );
        if (!group) {
          group = {
            context: identifier.context,
            path: `${groupPath}:${identifier.parentPath}`,
            identifiers: [],
          };
          product.input.identifierGroups.push(group);
        }
        const index = group.identifiers.length;
        group.identifiers.push({
          typeCode: identifier.typeCode,
          value: identifier.value,
          ...(identifier.typeName ? { typeName: identifier.typeName } : {}),
        });
        for (const [field, location] of identifier.locations)
          product.locations.set(`${group.path}/${index}/${field}`, location);
      }
      product.identifier = undefined;
    }
    if (node.local === "Product" || node.local === "product") {
      products.push(product);
      product = undefined;
    }
  });
  parser.on("error", (error: Error) => {
    parseError = {
      message: error.message,
      line: parser.line + 1,
      column: parser.column + 1,
    };
  });
  try {
    parser.write(xml).close();
  } catch (error) {
    if (!parseError)
      parseError = {
        message: error instanceof Error ? error.message : "Invalid XML",
      };
  }
  const base = validateOnixCodes({});
  if (parseError) return { ...base, malformedXml: parseError };
  if (
    (root !== "ONIXMessage" && root !== "ONIXmessage") ||
    !release?.startsWith("3.1")
  )
    return {
      ...base,
      unsupportedMessage: {
        root,
        release,
        message: "Expected an ONIX 3.1 reference- or short-tag message.",
      },
    };
  const findings: ValidationFinding[] = [];
  for (const [index, state] of products.entries()) {
    const report = validateOnixCodes(state.input, options);
    for (const item of report.findings) {
      const location = state.locations.get(item.path) ?? {
        xmlPath: `/Product[${index + 1}]`,
        productIndex: index,
      };
      findings.push({
        ...item,
        path: `/products/${index}${item.path}`,
        sourceLocation: location,
      });
    }
  }
  return createValidationReport(findings);
}
