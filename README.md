# onix-codelists

`onix-codelists` provides programmatic access to official ONIX for Books codelists: given an ONIX codelist number, retrieve its codes and headings. It is deliberately not an ONIX XML parser, validator, subject-classification package, or search engine.

The included data is generated from **EDItEUR ONIX for Books Codelists Issue 74**. EDItEUR remains the authority for ONIX and its codelists.

> TODO before public publication: confirm EDItEUR's exact redistribution, attribution, and licensing requirements for the source data.

## Install

```bash
pnpm add onix-codelists
```

## Usage

```ts
import {
  getCodelistEntries,
  getCodelistEntry,
  getCodelistHeading,
  hasCodelistCode,
  metadata,
} from "onix-codelists";

const subjectSchemes = getCodelistEntries(27);
const thema = getCodelistEntry(27, "93");
const themaHeading = getCodelistHeading(27, "93");
const valid = hasCodelistCode(27, "93");

console.log(metadata.issue); // 74
```

To retrieve a complete list, use `getCodelist(27)`. `getCodelists()` returns lightweight `{ number, heading }` summaries. Codes are always strings, so leading zeroes such as `"01"` are preserved.

Entries work directly as form options:

```tsx
const options = getCodelistEntries(27).map(({ code, heading }) => ({
  value: code,
  label: `${code} — ${heading}`,
}));
```

## Browser demo

After installing dependencies, start the local codelist browser with:

```bash
pnpm demo
```

It opens a Vite development server where you can select a codelist and filter
its entries by code or heading.

## Updating the source data

Place exactly one official EDItEUR JSON export named
`ONIX_BookProduct_Codelists_Issue_<issue>.json` in `data/raw/`, then run:

```bash
pnpm generate
pnpm validate:data
pnpm test
```

The importer never modifies files in `data/raw/`. It writes normalized JSON under `data/generated/` and runtime TypeScript modules under `src/generated/`; both are generated files and must not be edited manually. The official JSON contains the human-readable codelist titles, including lists with no entries.

Additional official fields (notes and issue-added, issue-modified, and issue-deprecated values) are retained in `data/generated/codelists.json` for future expansion, while the V1 public entry API intentionally exposes only `code` and `heading`.
