# Architecture

The package has two primary workflows: codelist discovery and ONIX XML generation. Validation supports generation by checking the finished XML.

```text
Official codelist and Thema JSON ──> generated TypeScript data ──> lookup APIs

Official non-strict ONIX 3.1.3 XSDs ──> compact construction metadata
                                  └──> xmllint-wasm validation

Application data ──> ONIX builders ──> canonical ONIX model
                                      └──> serializer ──> ONIX XML
                                                           └──> validator
```

Applications own mapping from their domain model to ONIX. The builders provide common helpers and generic composite methods, but never infer missing business facts. The serializer uses generated element names, parent-child relationships, and order. It reports unsupported input rather than omitting it. The non-strict official XSDs check the serialized XML separately.

The XSDs are copied unchanged into `standards/onix/3.1.3/` for the published package. `scripts/verify-standards.ts` checks them against their pinned sources in `data/raw/`. Schema version `3.1.3.1` and codelist Issue 74 are independent inputs.

Strict ONIX validation is a future validator implementation. The current result type reports which standard schema was applied, so a future validation profile can be added without making the serializer depend on a strict validator.
