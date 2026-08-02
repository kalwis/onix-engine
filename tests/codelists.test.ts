import { describe, expect, it } from "vitest";
import {
  getCodelist,
  getCodelistEntries,
  getCodelistEntry,
  getCodelistHeading,
  getCodelists,
  hasCodelistCode,
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
