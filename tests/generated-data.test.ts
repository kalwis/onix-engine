import { describe, expect, it } from "vitest";
import { codelists } from "../src/generated/codelists.js";
import { metadata } from "../src/generated/metadata.js";
import { themaEntries } from "../src/generated/thema.js";
import { themaMetadata } from "../src/generated/thema-metadata.js";

describe("generated ONIX data", () => {
  it("has valid metadata", () => {
    expect(metadata.issue).toBe(74);
    expect(new Date(metadata.generatedAt).toISOString()).toBe(
      metadata.generatedAt,
    );
  });

  it("has numbers, headings, and no duplicate codes", () => {
    expect(codelists).toHaveLength(166);
    expect(
      codelists.reduce((count, list) => count + list.entries.length, 0),
    ).toBe(4791);
    for (const list of codelists) {
      expect(typeof list.number).toBe("number");
      expect(list.heading).not.toHaveLength(0);
      expect(list.heading).not.toBe(`ONIX codelist ${list.number}`);
      expect(new Set(list.entries.map((entry) => entry.code)).size).toBe(
        list.entries.length,
      );
      for (const entry of list.entries) {
        expect(typeof entry.code).toBe("string");
        expect(entry.code).not.toHaveLength(0);
        expect(typeof entry.heading).toBe("string");
        expect(entry.heading).not.toHaveLength(0);
      }
    }
  });

  it("uses official codelist headings", () => {
    expect(codelists).toContainEqual(
      expect.objectContaining({
        number: 1,
        heading: "Notification or update type",
      }),
    );
    expect(codelists).toContainEqual(
      expect.objectContaining({
        number: 27,
        heading: "Subject scheme identifier",
      }),
    );
    expect(codelists).toContainEqual(
      expect.objectContaining({
        number: 88,
        heading: "Religious text identifier",
        entries: [],
      }),
    );
  });
});

describe("generated Thema data", () => {
  it("has valid metadata", () => {
    expect(themaMetadata).toMatchObject({
      issue: 1.6,
      version: "v1.6.0",
      lastUpdated: "2025-04-10",
    });
    expect(new Date(themaMetadata.generatedAt).toISOString()).toBe(
      themaMetadata.generatedAt,
    );
  });

  it("has complete, unique codes with valid parents", () => {
    expect(themaEntries).toHaveLength(9187);
    const codes = new Set(themaEntries.map((entry) => entry.code));
    expect(codes.size).toBe(themaEntries.length);
    for (const entry of themaEntries) {
      expect(entry.code).not.toHaveLength(0);
      expect(entry.heading).not.toHaveLength(0);
      if (entry.parentCode) expect(codes.has(entry.parentCode)).toBe(true);
    }
  });

  it("preserves hierarchy and usage notes", () => {
    expect(themaEntries).toContainEqual(
      expect.objectContaining({
        code: "AB",
        parentCode: "A",
        heading: "The arts: general topics",
      }),
    );
    expect(themaEntries.find((entry) => entry.code === "A")?.note).toContain(
      "Use all A* codes",
    );
  });
});
