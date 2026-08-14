import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import schema from "../data/generated/onix-3.1.3-schema.json" with { type: "json" };
import manifest from "../data/generated/onix-3.1.3-source-manifest.json" with { type: "json" };

const root = resolve(import.meta.dirname, "..");

describe("ONIX 3.1.3 schema source and IR", () => {
  it("pins every source file by hash and identifies the strict Issue 74 roots", async () => {
    expect(manifest).toMatchObject({
      onixRelease: "3.1.3",
      schemaVersion: "3.1.3.74.0",
      codelistIssue: 74,
    });
    for (const file of manifest.files)
      expect(
        createHash("sha256")
          .update(await readFile(resolve(root, file.path)))
          .digest("hex"),
      ).toBe(file.sha256);
    expect(manifest.canonicalRoots).toHaveLength(2);
  });

  it("preserves schema structure, rules, includes, and tag aliases", () => {
    const strictReference = schema.documents.find((document) =>
      document.path.endsWith("reference_strict.xsd"),
    );
    expect(strictReference?.version).toBe("3.1.3.74.0");
    expect(strictReference?.includes).toEqual(
      expect.arrayContaining([
        "ONIX_BookProduct_CodeLists.xsd",
        "ONIX_XHTML_Subset.xsd",
      ]),
    );
    expect(
      strictReference?.components.some(
        (component) => component.name === "ONIXMessage",
      ),
    ).toBe(true);
    expect(
      strictReference?.components.some(
        (component) => component.name === "Header",
      ),
    ).toBe(true);
    expect(
      strictReference?.components.some(
        (component) => component.name === "Product",
      ),
    ).toBe(true);
    expect(
      strictReference?.components.some((component) =>
        component.content.some(
          (node: { kind: string }) => node.kind === "sequence",
        ),
      ),
    ).toBe(true);
    expect(
      schema.documents
        .flatMap((document) => document.rules)
        .some((rule) => rule.kind === "assert"),
    ).toBe(true);
    expect(
      schema.documents
        .flatMap((document) => document.rules)
        .some((rule) => rule.kind === "report"),
    ).toBe(true);
    expect(schema.aliases).toContainEqual({
      reference: "ONIXMessage",
      short: "ONIXmessage",
    });
    expect(new Set(schema.aliases.map((alias) => alias.reference)).size).toBe(
      schema.aliases.length,
    );
    expect(new Set(schema.aliases.map((alias) => alias.short)).size).toBe(
      schema.aliases.length,
    );
  });
});
