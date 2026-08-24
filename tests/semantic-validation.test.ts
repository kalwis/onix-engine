import { describe, expect, it } from "vitest";
import {
  semanticManifest,
  semanticCodelistRuleAudit,
  themaSemanticRuleAudit,
  identifierContextRegistry,
  isThemaCodeAssignable,
  validateOnixCodes,
  validateOnixField,
  validateOnixXml,
  validateThemaAssignments,
  themaNonAssignableCodes,
} from "../src/index.js";
import { themaEntries } from "../src/generated/thema.js";

function themaSchemeForCode(code: string): string {
  return code.startsWith("1")
    ? "94"
    : code.startsWith("2")
      ? "95"
      : code.startsWith("3")
        ? "96"
        : code.startsWith("4")
          ? "97"
          : code.startsWith("5")
            ? "98"
            : code.startsWith("6")
              ? "99"
              : "93";
}

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
        { schemeCode: "94", code: "1A" },
      ]).findings,
    ).toEqual([]);
    expect(
      validateThemaAssignments([
        { schemeCode: "93", code: "AB", isMain: true },
        { schemeCode: "93", code: "AC", isMain: true },
      ]).findings.map((item) => item.ruleId),
    ).toContain("ONIX-SUBJECT-MULTIPLE-MAIN");
  });

  it("exports the reviewed immutable v1.6 non-assignable code set", () => {
    expect(themaNonAssignableCodes).toEqual([
      "1",
      "1Q",
      "2",
      "3",
      "4",
      "5",
      "5A",
      "5T",
      "5Y",
      "6",
      "C",
      "D",
      "F",
      "FY",
      "G",
      "L",
      "N",
      "P",
      "Q",
      "R",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "YFZ",
      "6A",
      "6B",
      "6C",
      "6D",
      "6E",
      "6F",
      "6G",
      "6H",
      "6J",
      "6K",
      "6L",
      "6M",
      "6N",
      "6P",
      "6Q",
      "6R",
      "6S",
      "6SX",
      "6T",
      "6U",
      "6V",
      "6W",
      "6X",
    ]);
    expect(Object.isFrozen(themaNonAssignableCodes)).toBe(true);
    expect(isThemaCodeAssignable("C")).toBe(false);
    expect(isThemaCodeAssignable("6A")).toBe(false);
    expect(isThemaCodeAssignable("not-a-code")).toBe(false);
    expect(isThemaCodeAssignable("A")).toBe(true);
    expect(isThemaCodeAssignable("S")).toBe(true);
  });

  it("enforces curated assignability only for Thema schemes", () => {
    for (const code of ["C", "1", "FY", "5A", "6A"])
      expect(
        validateThemaAssignments([
          { schemeCode: themaSchemeForCode(code), code },
        ]).findings,
      ).toContainEqual(
        expect.objectContaining({
          ruleId: "THEMA-CODE-NON-ASSIGNABLE",
          path: "/subjects/0/code",
        }),
      );
    expect(
      validateThemaAssignments([{ schemeCode: "93", code: "A" }]).findings,
    ).toEqual([]);
    expect(
      validateThemaAssignments([{ schemeCode: "93", code: "S" }]).findings,
    ).toEqual([]);
    expect(
      validateThemaAssignments([{ schemeCode: "10", code: "ABC" }]).findings,
    ).toContainEqual(
      expect.objectContaining({
        ruleId: "THEMA-SCHEME",
        path: "/subjects/0/schemeCode",
      }),
    );
    expect(
      validateOnixCodes({ subjects: [{ schemeCode: "24", code: "ABC" }] })
        .findings,
    ).toEqual([]);
  });

  it("applies curated Thema assignment pairs at the later code path", () => {
    for (const assignments of [
      [
        { schemeCode: "93", code: "FP" },
        { schemeCode: "93", code: "FRX" },
      ],
      [
        { schemeCode: "93", code: "FRX" },
        { schemeCode: "93", code: "FP" },
      ],
      [
        { schemeCode: "93", code: "FXD" },
        { schemeCode: "93", code: "FRB" },
      ],
      [
        { schemeCode: "93", code: "FRB" },
        { schemeCode: "93", code: "FXD" },
      ],
      [
        { schemeCode: "98", code: "5AV" },
        { schemeCode: "93", code: "YF" },
      ],
      [
        { schemeCode: "93", code: "YF" },
        { schemeCode: "98", code: "5AV" },
      ],
    ])
      expect(validateThemaAssignments(assignments).findings).toContainEqual(
        expect.objectContaining({
          ruleId: "THEMA-MUTUALLY-EXCLUSIVE",
          path: "/subjects/1/code",
        }),
      );
  });

  it("limits main subjects and curated main-category restrictions", () => {
    expect(
      validateOnixCodes({
        subjects: [{ schemeCode: "94", code: "1A", isMain: true }],
      }).findings,
    ).toContainEqual(
      expect.objectContaining({
        ruleId: "ONIX-SUBJECT-MAIN-SCHEME",
        path: "/subjects/0/isMain",
      }),
    );
    expect(
      validateOnixCodes({
        subjects: [{ schemeCode: "10", code: "FIC000000", isMain: true }],
      }).findings,
    ).toEqual([]);
    for (const code of ["FX", "FXD", "FYR", "FYT", "YFZT"])
      expect(
        validateOnixCodes({
          subjects: [{ schemeCode: "93", code, isMain: true }],
        }).findings,
      ).toContainEqual(
        expect.objectContaining({
          ruleId: "THEMA-MAIN-CATEGORY",
          path: "/subjects/0/code",
        }),
      );
  });

  it("requires a primary Thema subject when qualifiers are supplied", () => {
    expect(
      validateThemaAssignments([{ schemeCode: "94", code: "1" }]).findings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "THEMA-QUALIFIER-WITHOUT-PRIMARY",
          path: "/subjects/0/schemeCode",
        }),
      ]),
    );
    expect(
      validateThemaAssignments([
        { schemeCode: "93", code: "AB" },
        { schemeCode: "94", code: "1A" },
      ]).findings,
    ).toEqual([]);
    expect(validateThemaAssignments([]).findings).toEqual([]);
  });

  it("keeps demo-style subject findings on their canonical indexed paths", () => {
    const valid = validateOnixCodes({
      subjects: [
        { schemeCode: "93", code: "AB", isMain: true },
        { schemeCode: "94", code: "1" },
      ],
    });
    expect(valid.findings).not.toContainEqual(
      expect.objectContaining({ ruleId: "THEMA-QUALIFIER-WITHOUT-PRIMARY" }),
    );

    const invalid = validateOnixCodes({
      subjects: [
        { schemeCode: "94", code: "AB" },
        { schemeCode: "94", code: "AB" },
      ],
    });
    expect(invalid.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "THEMA-SCHEME-ELIGIBILITY",
          path: "/subjects/0/schemeCode",
        }),
        expect.objectContaining({
          ruleId: "ONIX-SUBJECT-DUPLICATE",
          path: "/subjects/1",
        }),
      ]),
    );
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

  it("audits every non-empty pinned Thema note without enforcing its prose", () => {
    expect(themaSemanticRuleAudit).toHaveLength(4059);
    expect(Object.isFrozen(themaSemanticRuleAudit)).toBe(true);
    const auditByCode = new Map(
      themaSemanticRuleAudit.map((entry) => [entry.code, entry]),
    );
    for (const entry of themaEntries.filter((entry) => entry.note))
      expect(auditByCode.get(entry.code)?.rawNote).toBe(entry.note);
    expect(themaSemanticRuleAudit).toContainEqual(
      expect.objectContaining({
        code: "ABA",
        rawNote: "See also: QDTN",
        cue: "See also",
        referencedCodeLikeTokens: expect.arrayContaining(["QDTN"]),
        classification: "unsupported-candidate",
        source: expect.objectContaining({
          type: "thema",
          version: "v1.6.0",
          lastUpdated: "2025-04-10",
        }),
      }),
    );
  });

  it("covers every identifier composite and validates its canonical tuples", () => {
    expect(identifierContextRegistry.length).toBeGreaterThan(20);
    expect(identifierContextRegistry).toContainEqual(
      expect.objectContaining({ context: "ProductIdentifier", typeList: 5 }),
    );
    const report = validateOnixCodes({
      identifierGroups: [
        {
          context: "ProductIdentifier",
          path: "/productIdentifiers",
          identifiers: [
            { typeCode: "01", value: "SKU-1" },
            { typeCode: "15", value: "9780306406158" },
            { typeCode: "15", value: "9780306406158" },
            { typeCode: "99", value: "x" },
          ],
        },
      ],
    });
    expect(report.findings.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        "ONIX-IDENTIFIER-PROPRIETARY-NAME",
        "ONIX-IDENTIFIER-DUPLICATE",
        "ONIX-IDENTIFIER-VALUE",
        "ONIX-5-IDENTIFIER-TYPE",
      ]),
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

  it("extracts identifiers from reference and short-tag XML", () => {
    const reference =
      '<ONIXMessage release="3.1"><Product><ProductIdentifier><ProductIDType>15</ProductIDType><IDValue>9780306406158</IDValue></ProductIdentifier></Product></ONIXMessage>';
    const short =
      '<ONIXmessage release="3.1"><product><productidentifier><b221>15</b221><b244>9780306406158</b244></productidentifier></product></ONIXmessage>';
    for (const xml of [reference, short])
      expect(
        validateOnixXml(xml).findings.map((item) => item.ruleId),
      ).toContain("ONIX-IDENTIFIER-VALUE");
  });

  it("normalizes Thema qualifiers from reference and short-tag XML", () => {
    const reference =
      '<ONIXMessage release="3.1"><Product><Subject><SubjectSchemeIdentifier>94</SubjectSchemeIdentifier><SubjectCode>1</SubjectCode></Subject></Product></ONIXMessage>';
    const short =
      '<ONIXmessage release="3.1"><product><subject><b067>94</b067><b069>1</b069></subject></product></ONIXmessage>';
    for (const xml of [reference, short])
      expect(validateOnixXml(xml).findings).toContainEqual(
        expect.objectContaining({
          ruleId: "THEMA-QUALIFIER-WITHOUT-PRIMARY",
          path: "/products/0/subjects/0/schemeCode",
        }),
      );
  });
});
