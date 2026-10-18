import {
  aliasesByReference,
  elementDefinition,
  propertyName,
} from "./metadata.js";
import type {
  OnixInlineElement,
  OnixMessage,
  OnixNode,
  OnixValue,
  OnixXmlOptions,
} from "../types/onix.js";

const namespaces = {
  reference: "http://ns.editeur.org/onix/3.1/reference",
  short: "http://ns.editeur.org/onix/3.1/short",
};
const xmlName = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

export class OnixConstructionError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${message} at ${path}`);
    this.name = "OnixConstructionError";
  }
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function writeAttributes(
  attributes: Readonly<Record<string, string>> | undefined,
  path: string,
): string {
  return Object.entries(attributes ?? {})
    .map(([name, value]) => {
      if (!xmlName.test(name))
        throw new OnixConstructionError(`Invalid attribute name ${name}`, path);
      return ` ${name}="${escapeAttribute(value)}"`;
    })
    .join("");
}

function inline(value: string | OnixInlineElement, path: string): string {
  if (typeof value === "string") return escapeText(value);
  if (!xmlName.test(value.name) || value.name.includes(":"))
    throw new OnixConstructionError(
      `Invalid inline element ${value.name}`,
      path,
    );
  const tag = value.name;
  const attrs = writeAttributes(value.attributes, `${path}/${tag}`);
  const body = (value.content ?? [])
    .map((child) => inline(child, `${path}/${tag}`))
    .join("");
  return body ? `<${tag}${attrs}>${body}</${tag}>` : `<${tag}${attrs}/>`;
}

function values(value: unknown): readonly OnixValue[] {
  return value === undefined
    ? []
    : Array.isArray(value)
      ? (value as readonly OnixValue[])
      : [value as OnixValue];
}

function write(
  reference: string,
  value: OnixValue,
  tags: "reference" | "short",
  path: string,
): string {
  const definition = elementDefinition(reference);
  if (!definition)
    throw new OnixConstructionError(`Unknown ONIX element ${reference}`, path);
  const tag = tags === "short" ? aliasesByReference.get(reference) : reference;
  if (!tag)
    throw new OnixConstructionError(
      `Missing short-tag mapping for ${reference}`,
      path,
    );
  if (typeof value === "string")
    return value ? `<${tag}>${escapeText(value)}</${tag}>` : `<${tag}/>`;
  const node: OnixNode = value;
  const attrs = writeAttributes(node.$attributes, path);
  const allowed = new Map(
    definition.children.map((name) => [propertyName(name), name]),
  );
  for (const key of Object.keys(value)) {
    if (key === "$attributes" || key === "$value" || key === "$content")
      continue;
    if (!allowed.has(key))
      throw new OnixConstructionError(
        `Unknown or misplaced field ${key}`,
        path,
      );
  }
  if (
    node.$content &&
    (node.$value !== undefined ||
      definition.children.some(
        (name) => node[propertyName(name)] !== undefined,
      ))
  )
    throw new OnixConstructionError(
      "Formatted content cannot be combined with ONIX child fields or $value",
      path,
    );
  let body =
    node.$content?.map((part) => inline(part, path)).join("") ??
    escapeText(node.$value ?? "");
  for (const name of definition.children) {
    const key = propertyName(name);
    for (const child of values(node[key]))
      body += write(name, child, tags, `${path}/${name}`);
  }
  return body ? `<${tag}${attrs}>${body}</${tag}>` : `<${tag}${attrs}/>`;
}

/** Serialize a canonical ONIX model; use validateOnix for XSD compliance. */
export function serializeOnix(
  message: OnixMessage,
  options: OnixXmlOptions = {},
): string {
  const tags = options.tags ?? "reference";
  const attributes = {
    release: "3.1",
    xmlns: namespaces[tags],
    ...(message.$attributes ?? {}),
  };
  if (attributes.xmlns !== namespaces[tags])
    throw new OnixConstructionError(
      "Root namespace conflicts with selected tag style",
      "/ONIXMessage",
    );
  const xml = write(
    "ONIXMessage",
    { ...message, $attributes: attributes },
    tags,
    "/ONIXMessage",
  );
  return options.declaration === false
    ? xml
    : `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}
