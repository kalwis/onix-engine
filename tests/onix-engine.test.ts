import { describe, expect, it } from "vitest";
import {
  createOnixMessage,
  parseOnixXml,
  serializeOnixXml,
  validateOnixMessage,
} from "../src/index.js";
import type { OnixMessage } from "../src/types/onix.js";

/** Confluence first-slice single-product message (Flip maps ProductEntity → this shape). */
function confluenceProductMessage(): OnixMessage {
  return {
    header: {
      sender: { senderName: "Example publisher" },
      sentDateTime: "20250107",
    },
    product: {
      recordReference: "9780655212065",
      notificationType: "03",
      productIdentifier: [{ productIDType: "15", iDValue: "9780655212065" }],
      descriptiveDetail: {
        productComposition: "00",
        productForm: "BH",
        productFormDetail: ["B305"],
        measure: [
          { measureType: "01", measurement: "137", measureUnitCode: "mm" },
          { measureType: "02", measurement: "190", measureUnitCode: "mm" },
        ],
        titleDetail: [
          {
            titleType: "01",
            titleElement: [
              {
                titleElementLevel: "01",
                noPrefix: "",
                titleWithoutPrefix: "10 Bk Carry Along Early Learning",
              },
            ],
          },
        ],
        contributor: [
          {
            sequenceNumber: "1",
            contributorRole: ["C01"],
            personName: "Lake Press",
          },
        ],
        subject: [
          {
            subjectSchemeIdentifier: "12",
            subjectSchemeVersion: "2.1",
            subjectCode: "YBL",
          },
        ],
        audience: [{ audienceCodeType: "01", audienceCodeValue: "02" }],
        audienceRange: [
          {
            audienceRangeQualifier: "17",
            audienceRangePrecision: "03",
            audienceRangeValue: "1",
          },
        ],
      },
      publishingDetail: {
        imprint: [{ imprintName: "Lake Press" }],
      },
    },
  };
}

describe("canonical ONIX engine", () => {
  it("serializes generated reference and short tag mappings in schema order", () => {
    const message = {
      header: { sender: { senderName: "Example publisher" } },
      product: {
        recordReference: "example-1",
        notificationType: "03",
        descriptiveDetail: { productComposition: "00", productForm: "BC" },
      },
    };
    const reference = serializeOnixXml(message, { declaration: false });
    const short = serializeOnixXml(message, { tags: "short", declaration: false });
    expect(reference).toContain('<ONIXMessage release="3.1" xmlns="http://ns.editeur.org/onix/3.1/reference">');
    expect(reference).toContain("<Product>");
    expect(reference.indexOf("<RecordReference>")).toBeLessThan(reference.indexOf("<NotificationType>"));
    expect(short).toContain('<ONIXmessage release="3.1" xmlns="http://ns.editeur.org/onix/3.1/short">');
    expect(short).toContain("<product>");
    expect(short).toContain("<b012>BC</b012>");
  });

  it("parses short tags into reference-name canonical properties", () => {
    const parsed = parseOnixXml(
      '<ONIXmessage release="3.1"><header><sender><x298>Example</x298></sender></header><product><a001>x</a001><a002>03</a002></product></ONIXmessage>',
    );
    expect(parsed.message).toMatchObject({ product: { recordReference: "x", notificationType: "03" } });
  });

  it("runs curated codelist semantics after structural validation", () => {
    const report = validateOnixMessage({
      $attributes: { release: "3.1" },
      header: { sender: { senderName: "Example" } },
      product: { recordReference: "x", notificationType: "03", descriptiveDetail: { productForm: "BB", productFormDetail: "B135" } },
    });
    expect(report.findings.map((finding) => finding.ruleId)).toContain("ONIX-175-B135-PRODUCT-FORM");
  });

  it("offers fluent builders nesting descriptive particles correctly", () => {
    const message = createOnixMessage()
      .header({ sender: { senderName: "Example" } })
      .product((product) =>
        product
          .set("recordReference", "example-1")
          .set("notificationType", "03")
          .identifier("15", "9780306406157")
          .title("01", "Example")
          .contributor("A01", "Author")
          .subject("93", "AB", true),
      )
      .build();
    const product = Array.isArray(message.product) ? message.product[0] : message.product;
    expect(product).toMatchObject({
      productIdentifier: [{ productIDType: "15", iDValue: "9780306406157" }],
      descriptiveDetail: {
        titleDetail: [{ titleType: "01" }],
        contributor: [{ personName: "Author" }],
        subject: [{ subjectSchemeIdentifier: "93", subjectCode: "AB" }],
      },
    });
    expect(product).not.toHaveProperty("titleDetail");
    const report = validateOnixMessage({ ...message, $attributes: { release: "3.1" } });
    expect(report.findings.filter((finding) => finding.ruleId === "ONIX-UNKNOWN-ELEMENT")).toEqual([]);
    const xml = serializeOnixXml(message, { declaration: false });
    expect(xml).toContain("<DescriptiveDetail>");
    expect(xml).toContain("<TitleDetail>");
  });

  it("serializes a Confluence-shaped single-product message", () => {
    const message = confluenceProductMessage();
    const report = validateOnixMessage({ ...message, $attributes: { release: "3.1" } });
    expect(report.findings.filter((finding) => finding.severity === "error" && finding.source.type === "schema")).toEqual([]);

    const reference = serializeOnixXml(message, { declaration: false });
    expect(reference).toContain('release="3.1"');
    expect(reference).toContain('xmlns="http://ns.editeur.org/onix/3.1/reference"');
    expect(reference).toContain("<ProductIdentifier>");
    expect(reference).toContain("<ProductForm>BH</ProductForm>");
    expect(reference).toContain("<ProductFormDetail>B305</ProductFormDetail>");
    expect(reference).toContain("<Measure>");
    expect(reference).toContain("<TitleWithoutPrefix>");
    expect(reference).toContain("<NoPrefix/>");
    expect(reference).toContain("<Contributor>");
    expect(reference).toContain("<Subject>");
    expect(reference).toContain("<Audience>");
    expect(reference).toContain("<AudienceRange>");
    expect(reference).toContain("<Imprint>");
    expect(reference.indexOf("<DescriptiveDetail>")).toBeLessThan(reference.indexOf("<PublishingDetail>"));
    expect(reference.indexOf("<ProductComposition>")).toBeLessThan(reference.indexOf("<ProductForm>"));

    const short = serializeOnixXml(message, { tags: "short", declaration: false });
    expect(short).toContain('xmlns="http://ns.editeur.org/onix/3.1/short"');
    expect(short).toContain("<b012>BH</b012>");
  });

  it("parses empty NoPrefix elements", () => {
    const parsed = parseOnixXml(
      '<ONIXMessage release="3.1"><Header><Sender><SenderName>Example</SenderName></Sender></Header><Product><RecordReference>x</RecordReference><NotificationType>03</NotificationType><DescriptiveDetail><TitleDetail><TitleType>01</TitleType><TitleElement><TitleElementLevel>01</TitleElementLevel><NoPrefix/><TitleWithoutPrefix>Example</TitleWithoutPrefix></TitleElement></TitleDetail></DescriptiveDetail></Product></ONIXMessage>',
    );
    const product = Array.isArray(parsed.message?.product) ? parsed.message?.product[0] : parsed.message?.product;
    const descriptive = product && typeof product === "object" ? product.descriptiveDetail : undefined;
    const titleDetail = descriptive && typeof descriptive === "object" ? descriptive.titleDetail : undefined;
    const firstTitle = Array.isArray(titleDetail) ? titleDetail[0] : titleDetail;
    const titleElement = firstTitle && typeof firstTitle === "object" ? firstTitle.titleElement : undefined;
    const firstElement = Array.isArray(titleElement) ? titleElement[0] : titleElement;
    expect(firstElement).toMatchObject({ noPrefix: "", titleWithoutPrefix: "Example" });
  });
});
