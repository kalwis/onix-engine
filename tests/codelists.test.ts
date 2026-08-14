import { describe, expect, it } from "vitest";
import {
  getCodelist,
  getCodelistEntries,
  getCodelistEntry,
  getCodelistHeading,
  getCodelists,
  createSubjectVocabulary,
  getThemaChildren,
  getThemaEntries,
  getThemaEntry,
  getThemaHeading,
  hasCodelistCode,
  hasThemaCode,
  themaMetadata,
} from "../src/index.js";

describe("ONIX codelists", () => {
  it("retrieves a known codelist", () => {
    expect(getCodelist(27)).toMatchObject({ number: 27 });
  });

  it("retrieves all entries in a codelist", () => {
    expect(getCodelistEntries(27)).toContainEqual({
      code: "93",
      heading: "Thema subject category",
    });
  });

  it("retrieves an individual entry and its heading", () => {
    expect(getCodelistEntry(27, "93")).toEqual({
      code: "93",
      heading: "Thema subject category",
    });
    expect(getCodelistHeading(27, "93")).toBe("Thema subject category");
  });

  it("checks whether a code exists", () => {
    expect(hasCodelistCode(27, "93")).toBe(true);
    expect(hasCodelistCode(27, "not-a-code")).toBe(false);
  });

  it("returns empty or undefined values for unknown lists and codes", () => {
    expect(getCodelist(999_999)).toBeUndefined();
    expect(getCodelistEntries(999_999)).toEqual([]);
    expect(getCodelistEntry(27, "not-a-code")).toBeUndefined();
    expect(getCodelistHeading(27, "not-a-code")).toBeUndefined();
  });

  it("preserves leading zeroes", () => {
    expect(getCodelistEntry(1, "01")).toMatchObject({ code: "01" });
    expect(getCodelistEntry(1, "1")).toBeUndefined();
  });

  it("returns codelist summaries", () => {
    expect(getCodelists()).toContainEqual(
      expect.objectContaining({ number: 27 }),
    );
  });
});

describe("Thema", () => {
  it("retrieves a known entry with its hierarchy and note", () => {
    expect(getThemaEntry("AB")).toMatchObject({
      code: "AB",
      heading: "The arts: general topics",
      parentCode: "A",
    });
    expect(getThemaEntry("A")?.note).toContain("Use all A* codes");
  });

  it("lists entries and supports hierarchy navigation", () => {
    expect(getThemaEntries()).toHaveLength(9187);
    expect(getThemaChildren()).toContainEqual(
      expect.objectContaining({ code: "A", heading: "The Arts" }),
    );
    expect(getThemaChildren("A")).toContainEqual(
      expect.objectContaining({ code: "AB", parentCode: "A" }),
    );
  });

  it("retrieves headings and checks whether codes exist", () => {
    expect(getThemaHeading("JNA")).toBe("Philosophy and theory of education");
    expect(hasThemaCode("JNA")).toBe(true);
    expect(getThemaEntry("not-a-code")).toBeUndefined();
    expect(hasThemaCode("not-a-code")).toBe(false);
    expect(getThemaChildren("not-a-code")).toEqual([]);
  });

  it("exports Thema source metadata", () => {
    expect(themaMetadata).toMatchObject({
      version: "v1.6.0",
      lastUpdated: "2025-04-10",
    });
  });
});

describe("application-supplied subject vocabularies", () => {
  const document = {
    onixSchemeCode: "10",
    name: "BISAC Subject Headings",
    version: "2025",
    entries: [
      { code: "example-root", heading: "Example root" },
      {
        code: "example-child",
        heading: "Example child",
        parentCode: "example-root",
        note: "Example only; not BISAC source data.",
      },
    ],
  };

  it("creates isolated lookup and hierarchy helpers from a document", () => {
    const vocabulary = createSubjectVocabulary(document);
    expect(vocabulary.metadata).toEqual({
      onixSchemeCode: "10",
      name: "BISAC Subject Headings",
      version: "2025",
    });
    expect(vocabulary.getEntries()).toHaveLength(2);
    expect(vocabulary.getEntry("example-child")).toMatchObject({
      parentCode: "example-root",
    });
    expect(vocabulary.getHeading("example-root")).toBe("Example root");
    expect(vocabulary.hasCode("example-root")).toBe(true);
    expect(vocabulary.hasCode("missing")).toBe(false);
    expect(vocabulary.getChildren("example-root")).toContainEqual(
      expect.objectContaining({ code: "example-child" }),
    );
    expect(vocabulary.getChildren("missing")).toEqual([]);
  });

  it("accepts JSON strings", () => {
    expect(
      createSubjectVocabulary(JSON.stringify(document)).getEntry(
        "example-root",
      ),
    ).toMatchObject({
      heading: "Example root",
    });
  });

  it("rejects malformed or inconsistent input", () => {
    expect(() => createSubjectVocabulary("not json")).toThrow(
      "JSON is invalid",
    );
    expect(() =>
      createSubjectVocabulary({ ...document, onixSchemeCode: "unknown" }),
    ).toThrow("not an ONIX List 27 code");
    expect(() => createSubjectVocabulary({ ...document, version: "" })).toThrow(
      "version must be a non-blank string",
    );
    expect(() => createSubjectVocabulary({ ...document, entries: [] })).toThrow(
      "entries must be a non-empty array",
    );
    expect(() =>
      createSubjectVocabulary({
        ...document,
        entries: [document.entries[0], document.entries[0]],
      }),
    ).toThrow("Duplicate subject vocabulary code");
    expect(() =>
      createSubjectVocabulary({
        ...document,
        entries: [{ ...document.entries[0], parentCode: "missing" }],
      }),
    ).toThrow("references missing parent");
  });
});
