import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateOnix } from "../src/index.js";

const samples = resolve(
  import.meta.dirname,
  "../data/raw/ONIX_BookProduct_3.1_strict_XSDs+codes_Issue_74",
);

describe("standard ONIX XSD validation", () => {
  for (const [filename, tags] of [
    ["Onix3.1sample_refnames.xml", "reference"],
    ["Onix3.1sample_shorttags.xml", "short"],
  ] as const) {
    it(`accepts official ${tags} sample`, async () => {
      const xml = await readFile(resolve(samples, filename), "utf8");
      const report = await validateOnix(xml);
      expect(
        report,
        report.errors.map((error) => error.message).join("\n"),
      ).toMatchObject({ valid: true, tags, schemaVersion: "3.1.3.1" });
    }, 30000);
  }

  it("returns useful errors for structurally invalid XML", async () => {
    const xml =
      '<ONIXMessage release="3.1" xmlns="http://ns.editeur.org/onix/3.1/reference"><Product><MadeUp>bad</MadeUp></Product></ONIXMessage>';
    const report = await validateOnix(xml);
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]?.message).toBeTruthy();
  }, 30000);

  it("reports malformed XML without throwing", async () => {
    const report = await validateOnix(
      '<ONIXMessage xmlns="http://ns.editeur.org/onix/3.1/reference">',
    );
    expect(report.valid).toBe(false);
    expect(report.errors[0]?.message).toBeTruthy();
  }, 30000);
});
