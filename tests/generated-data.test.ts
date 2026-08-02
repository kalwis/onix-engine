import { describe, expect, it } from "vitest";
import { codelists } from "../src/generated/codelists.js";
import { metadata } from "../src/generated/metadata.js";

describe("generated ONIX data", () => {
  it("has valid metadata", () => {
    expect(metadata.issue).toBe(74);
    expect(new Date(metadata.generatedAt).toISOString()).toBe(
      metadata.generatedAt,
    );
  });

  it("has numbers, headings, and no duplicate codes", () => {
    for (const list of codelists) {
      expect(typeof list.number).toBe("number");
      expect(list.heading).not.toHaveLength(0);
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
});
