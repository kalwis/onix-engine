import { describe, expect, it } from "vitest";
import {
  createOnixMessage,
  createProduct,
  getCode,
  getList,
  getThemaEntry,
  OnixConstructionError,
  searchCodes,
  serializeOnix,
  validateOnix,
} from "../src/index.js";

describe("codelists and Thema", () => {
  it("preserves official code details and searches them", () => {
    expect(getList(150)?.heading).toBeTruthy();
    expect(getCode(150, "BC")?.code).toBe("BC");
    expect(getCode(150, "BC")).toHaveProperty("issueAdded");
    expect(
      searchCodes("paperback", { list: 150 }).some(
        (result) => result.entry.code === "BC",
      ),
    ).toBe(true);
    expect(getThemaEntry("AB")?.parentCode).toBe("A");
  });
});

describe("ONIX generation", () => {
  const product = createProduct({
    recordReference: "BOOK-001",
    notificationType: "03",
    isbn: "9780007232833",
    title: "Roseanna",
    productComposition: "00",
    productForm: "BC",
  });

  it("serializes reference and short tags in schema order", () => {
    const message = createOnixMessage()
      .header({ sender: { senderName: "Example" }, sentDateTime: "20250107" })
      .product(product)
      .build();
    const reference = serializeOnix(message);
    const short = serializeOnix(message, { tags: "short" });
    expect(reference).toContain("<RecordReference>BOOK-001</RecordReference>");
    expect(reference.indexOf("<RecordReference>")).toBeLessThan(
      reference.indexOf("<NotificationType>"),
    );
    expect(short).toContain("<ONIXmessage");
    expect(short).toContain("<a001>BOOK-001</a001>");
  });

  it("generates XML accepted by both official standard schemas", async () => {
    const message = createOnixMessage()
      .header({ sender: { senderName: "Example" }, sentDateTime: "20250107" })
      .product(product)
      .build();
    expect((await validateOnix(serializeOnix(message))).valid).toBe(true);
    expect(
      (await validateOnix(serializeOnix(message, { tags: "short" }))).valid,
    ).toBe(true);
  }, 30000);

  it("raises an error for an unsupported field", () => {
    const message = createOnixMessage()
      .product((item) => item.set("madeUpField", "x"))
      .build();
    expect(() => serializeOnix(message)).toThrow(OnixConstructionError);
  });

  it("preserves XHTML mixed-content order and escapes text", async () => {
    const detail = product.build().descriptiveDetail as Record<string, unknown>;
    const formatted = createProduct({
      recordReference: "BOOK-001",
      notificationType: "03",
      isbn: "9780007232833",
    }).set("descriptiveDetail", {
      ...detail,
      editionStatement: {
        $attributes: { textformat: "05" },
        $content: [
          "First & ",
          { name: "em", content: ["important"] },
          " last <line>",
        ],
      },
    });
    const message = createOnixMessage()
      .header({ sender: { senderName: "Example" }, sentDateTime: "20250107" })
      .product(formatted)
      .build();
    const xml = serializeOnix(message);
    expect(xml).toContain("First &amp; <em>important</em> last &lt;line&gt;");
    expect((await validateOnix(xml)).valid).toBe(true);
  });
});
