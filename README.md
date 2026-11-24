# onix-engine

`onix-engine` helps Node.js applications find ONIX codes and generate ONIX for Books 3.1 XML. Applications supply their own book, publishing, and supply data. The package builds reference- or short-tag XML and can validate it against the official non-strict ONIX 3.1.3 XSDs.

```bash
pnpm add onix-engine
```

## Find codes

```ts
import { getList, getCode, searchCodes, getThemaEntry } from "onix-engine";

getList(150); // Product form codelist
getCode(150, "BC"); // Heading, note, and issue history
searchCodes("paperback", { list: 150 });
getThemaEntry("AB"); // Thema hierarchy and note
```

The ONIX data comes from EDItEUR Codelists Issue 74. Thema v1.6.0 remains a separate vocabulary. Search includes deprecated codes by default so developers can inspect their history; pass `includeDeprecated: false` to hide them.

## Generate ONIX

```ts
import {
  createOnixMessage,
  createProduct,
  serializeOnix,
  validateOnix,
} from "onix-engine";

const product = createProduct({
  recordReference: "BOOK-001",
  notificationType: "03",
  isbn: "9780007232833",
  title: "Roseanna",
  productComposition: "00",
  productForm: "BC",
});

const message = createOnixMessage()
  .header({
    sender: { senderName: "Example publisher" },
    sentDateTime: "20250107",
  })
  .product(product)
  .build();

const xml = serializeOnix(message); // Reference tags
const shortXml = serializeOnix(message, { tags: "short" });
const result = await validateOnix(xml);
if (!result.valid) console.log(result.errors);
```

Builders offer `set(name, value)` and `add(name, value)` for additional ONIX reference-name fields. Use lower-camel property names in nested objects. The serializer orders known children using generated metadata and throws `OnixConstructionError` for unknown or misplaced fields. Required fields and code restrictions are checked by the XSD validator; serialization itself is synchronous.

For fields that permit formatted text, use `$content` to preserve text and XHTML order:

```ts
const statement = {
  $attributes: { textformat: "05" },
  $content: ["A ", { name: "em", content: ["special"] }, " edition"],
};
```

`$content` is escaped and serialized as XML nodes. The official XSD determines which formatting is valid in a specific field.

## Validation scope

`validateOnix(xml)` is asynchronous and uses `xmllint-wasm` with the pinned non-strict reference or short schema, version `3.1.3.1`. The package includes both XSDs and their codelist and XHTML dependencies. Passing this check does not establish strict XSD 1.1, Schematron, additional semantic rules, or trading-partner acceptance.

## Development

### Browser demo

Run `pnpm demo` to bundle and serve the compact ONIX product form, starting at `http://localhost:4173`. If that port is occupied, the server tries subsequent ports up to 20 higher; set `PORT` to choose the starting port. The form uses plain HTML controls and package codelists, showing code and description for coded values. Long codelists are searchable. It builds one ONIX 3.1 product record, supports repeatable identifiers, contributors, subjects, resources, and prices, and lets you copy or download the generated XML. Subject codes remain editable because their vocabulary depends on the selected scheme. The form uses reference tags by default and can output short tags. It does not run XSD validation in the browser; use `validateOnix(xml)` from the Node API to validate generated XML separately.

```bash
pnpm install
pnpm generate
pnpm validate:data
pnpm typecheck
pnpm test
pnpm build
```

Generation reads the pinned official files in `data/raw/` and writes runtime TypeScript data in `src/generated/`. It does not run for package consumers. The optional XSLT tools in `scripts/` are not part of the npm runtime.

## Migrating from 0.2

- `serializeOnixXml` becomes `serializeOnix`; `validateOnixXml` becomes asynchronous `validateOnix` and now reports standard XSD errors.
- `getCodelist` and `getCodelistEntry` become `getList` and `getCode`. Code entries now include notes and issue history.
- The public XML parser, object structural validator, schema export, and handwritten semantic validators have been removed. Applications should map their own data into the builders and validate the resulting XML.
- See [ARCHITECTURE.md](ARCHITECTURE.md) for the generation and validation boundary.

Project code is MIT licensed. EDItEUR standards and derived data remain under the [EDItEUR licence](https://doi.org/10.4400/nwgj); see [NOTICE](NOTICE).
