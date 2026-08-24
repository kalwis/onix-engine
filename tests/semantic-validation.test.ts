import { describe, expect, it } from "vitest";
import {
  semanticManifest,
  semanticCodelistRuleAudit,
  validateOnixCodes,
  validateOnixField,
  validateOnixXml,
  validateThemaAssignments,
} from "../src/index.js";

describe("semantic ONIX validation", () => {
  it("groups findings by immutable canonical path without clean paths", () => {
    const report = validateOnixCodes({
      productForm: "BB",
      productFormDetails: ["nope", "B135"],
    });

    expect(Object.isFrozen(report.findingsByPath)).toBe(true);
    expect(
      Object.isFrozen(report.findingsByPath["/productFormDetails/0"]),
    ).toBe(true);
    expect(report.findingsByPath).not.toHaveProperty("/productForm");
    expect(report.findingsByPath["/productFormDetails/0"]).toEqual(
      report.findings.filter((item) => item.path === "/productFormDetails/0"),
    );
  });

  it("selects the full validator's findings for one field", () => {
    const input = { productForm: "BB", productFormDetails: ["B135"] };
    const full = validateOnixCodes(input);
    const field = validateOnixField(input, "/productFormDetails/0");

    expect(field).toMatchObject({
      path: "/productFormDetails/0",
      versions: full.versions,
    });
    expect(field.findings).toEqual(
      full.findings.filter((item) => item.path === field.path),
    );
    expect(field.findings.map((item) => item.ruleId)).toContain(
      "ONIX-175-B135-PRODUCT-FORM",
    );
  });

  it("validates supplied fields without inventing missing companions", () => {
    expect(
      validateOnixField(
        { productComposition: "nope" },
        "/productComposition",
      ).findings.map((item) => item.ruleId),
    ).toEqual(["ONIX-2-CODE"]);
    expect(
      validateOnixField(
        { productFormDetails: ["B135"] },
        "/productFormDetails/0",
      ).findings,
    ).toEqual([]);
  });

  it("allows partial input but validates supplied codelist values", () => {
    expect(validateOnixCodes({}).findings).toEqual([]);
    expect(
      validateOnixCodes({ productComposition: "nope" }).findings[0]?.ruleId,
    ).toBe("ONIX-2-CODE");
  });

  it("uses reviewed exact product-form detail constraints", () => {
    expect(
      validateOnixCodes({
        productForm: "BB",
        productFormDetails: ["B135"],
      }).findings.map((item) => item.ruleId),
    ).toContain("ONIX-175-B135-PRODUCT-FORM");
    expect(
      validateOnixCodes({ productForm: "BC", productFormDetails: ["B135"] })
        .findings,
    ).toEqual([]);
  });

  it("extracts later codelist-note constraints, wildcards and detail dependencies", () => {
    expect(
      validateOnixCodes({ productForm: "BN", productFormDetails: ["B301"] })
        .findings,
    ).toEqual([]);
    expect(
      validateOnixCodes({
        productForm: "BB",
        productFormDetails: ["B301"],
      }).findings.map((item) => item.ruleId),
    ).toContain("ONIX-175-B301-B303-PRODUCT-FORM");
    expect(
      validateOnixCodes({ productForm: "EB", productFormDetails: ["D313"] })
        .findings,
    ).toEqual([]);
    expect(
      validateOnixCodes({
        productForm: "BE",
        productFormDetails: ["B313"],
      }).findings.map((item) => item.ruleId),
    ).toContain("ONIX-175-B313-PRODUCT-FORM");
    expect(
      validateOnixCodes({
        productForm: "BE",
        productFormDetails: ["B313", "B312"],
      }).findings,
    ).toEqual([]);
  });

  it("derives Thema eligibility from hierarchy and scopes mains to a scheme", () => {
    expect(
      validateThemaAssignments([{ schemeCode: "94", code: "AB" }]).findings.map(
        (item) => item.ruleId,
      ),
    ).toContain("THEMA-SCHEME-ELIGIBILITY");
    expect(
      validateThemaAssignments([
        { schemeCode: "93", code: "AB", isMain: true },
        { schemeCode: "94", code: "1", isMain: true },
      ]).findings,
    ).toEqual([]);
    expect(
      validateThemaAssignments([
        { schemeCode: "93", code: "AB", isMain: true },
        { schemeCode: "93", code: "AC", isMain: true },
      ]).findings.map((item) => item.ruleId),
    ).toContain("ONIX-SUBJECT-MULTIPLE-MAIN");
  });

  it("makes ancestor checking an opt-in best-practice policy", () => {
    const values = [
      { schemeCode: "93", code: "A" },
      { schemeCode: "93", code: "AB" },
    ];
    expect(validateThemaAssignments(values).findings).toEqual([]);
    expect(
      validateThemaAssignments(values, {
        rejectAncestorDescendant: true,
      }).findings.map((item) => item.ruleId),
    ).toContain("THEMA-ANCESTOR-DESCENDANT");
  });

  it("keeps provenance in the auditable manifest", () => {
    expect(
      semanticManifest.find(
        (rule) => rule.ruleId === "ONIX-175-B135-PRODUCT-FORM",
      ),
    ).toMatchObject({
      enforcement: "error",
      source: { type: "codelist-note", list: 175, code: "B135" },
    });
  });

  it("records every List 175 note, including unsupported prose", () => {
    expect(semanticCodelistRuleAudit).toContainEqual(
      expect.objectContaining({ code: "B313", extraction: "product-form" }),
    );
    expect(semanticCodelistRuleAudit).toContainEqual(
      expect.objectContaining({ code: "B134", extraction: "unsupported" }),
    );
  });
});

describe("ONIX XML adapter", () => {
  it("normalizes equivalent reference and short tag messages", () => {
    const reference =
      '<ONIXMessage release="3.1"><Product><ProductForm>BB</ProductForm><ProductFormDetail>B135</ProductFormDetail></Product></ONIXMessage>';
    const short =
      '<ONIXmessage release="3.1"><product><b013>BB</b013><b333>B135</b333></product></ONIXmessage>';
    const a = validateOnixXml(reference).findings.map((item) => item.ruleId);
    const b = validateOnixXml(short).findings.map((item) => item.ruleId);
    expect(a).toEqual(b);
    expect(
      validateOnixXml(reference).findings[0]?.sourceLocation,
    ).toMatchObject({
      productIndex: 0,
      xmlPath: expect.stringContaining("ProductFormDetail"),
    });
    expect(
      validateOnixXml(reference).findingsByPath[
        "/products/0/productFormDetails/0"
      ]?.map((item) => item.ruleId),
    ).toContain("ONIX-175-B135-PRODUCT-FORM");
  });

  it("reports malformed and unsupported messages separately", () => {
    expect(validateOnixXml("<ONIXMessage>").malformedXml).toBeDefined();
    expect(
      validateOnixXml('<ONIXMessage release="3.0"/>').unsupportedMessage,
    ).toBeDefined();
  });
});
