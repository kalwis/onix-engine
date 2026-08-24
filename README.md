# onix-engine

`onix-engine` provides programmatic access to official ONIX for Books codelists and the English Thema classification: retrieve codes, headings, and (for Thema) hierarchy and usage notes. It is deliberately not an ONIX XML parser, validator, or search engine.

The included data is generated from **EDItEUR ONIX for Books Codelists Issue 74** and **Thema v1.6**. EDItEUR remains the authority for both datasets.

ONIX-derived schemas and data remain © EDItEUR and are used under the EDItEUR licence (DOI [10.4400/nwgj](https://doi.org/10.4400/nwgj)). See [NOTICE](NOTICE). The project code itself is MIT licensed.

For the project's long-term transition into a general-purpose ONIX implementation toolkit, see [the architecture direction](ARCHITECTURE.md).

## Install

```bash
pnpm add onix-engine
```

## Usage

```ts
import {
  getCodelistEntries,
  getCodelistEntry,
  getCodelistHeading,
  hasCodelistCode,
  metadata,
  getThemaChildren,
  getThemaEntry,
  themaMetadata,
} from "onix-engine";

const subjectSchemes = getCodelistEntries(27);
const thema = getCodelistEntry(27, "93");
const themaHeading = getCodelistHeading(27, "93");
const valid = hasCodelistCode(27, "93");

console.log(metadata.issue); // 74

const arts = getThemaEntry("A");
const artsTopics = getThemaChildren("A");
const rootCategories = getThemaChildren();

console.log(arts?.note);
console.log(themaMetadata.version); // "v1.6.0"
```

To retrieve a complete list, use `getCodelist(27)`. `getCodelists()` returns lightweight `{ number, heading }` summaries. Codes are always strings, so leading zeroes such as `"01"` are preserved.

Entries work directly as form options:

```tsx
const options = getCodelistEntries(27).map(({ code, heading }) => ({
  value: code,
  label: `${code} — ${heading}`,
}));
```

Thema entries include `parentCode` for hierarchy navigation and `note` when the
official source supplies usage guidance. Use `getThemaEntries()` to retrieve the
complete flat list, `getThemaEntry(code)` or `getThemaHeading(code)` for lookup,
and `hasThemaCode(code)` for validation.

## Application-supplied subject vocabularies

Applications can use their own licensed subject data without adding it to this
package. Supply a normalized document (or its JSON string) to
`createSubjectVocabulary()`. The ONIX scheme must be a valid List 27 code;
BISAC Subject Heading uses `"10"`.

```ts
import { createSubjectVocabulary } from "onix-engine";

const bisac = createSubjectVocabulary(await response.text());

bisac.getEntry("your-code");
bisac.getChildren();
bisac.hasCode("your-code");
```

The JSON object must contain `onixSchemeCode`, `name`, `version`, and a
non-empty `entries` array. Each entry requires `code` and `heading`, and may
contain explicit `parentCode` and `note` values. The calling application is
responsible for source acquisition, licensing, storage, and upgrades; this
package does not bundle, scrape, download, or persist external vocabularies.

## Browser demo

After installing dependencies, start the local codelist browser with:

```bash
pnpm demo
```

It opens a Vite development server where you can switch between ONIX codelists
and Thema, then filter entries by code or heading.

To explore field-level validation with an editable product-code draft, run:

```bash
pnpm demo:validation
```

The validation demo shows each field's exact-path findings alongside the full
validation report grouped by canonical path, with repeatable Thema subject and
qualifier assignments restricted to the selected List 27 scheme.

`isThemaCodeAssignable(code)` and `themaNonAssignableCodes` expose a curated,
immutable v1.6 assignment policy for codes that the pinned Thema notes say not
to assign directly. This list is hand-maintained: update it only after an
explicit review of the pinned Thema notes; it is not derived during generation
or at runtime.

## Updating the source data

Place exactly one official ONIX export named
`ONIX_BookProduct_Codelists_Issue_<issue>.json` and exactly one English Thema
export named `<YYYYMMDD>_Thema_v<version>_en.json` in `data/raw/`, then run:

```bash
pnpm generate
pnpm validate:data
pnpm test
```

The importer never modifies files in `data/raw/`. It writes normalized JSON under `data/generated/` and runtime TypeScript modules under `src/generated/`; both are generated files and must not be edited manually. The official JSON contains the human-readable codelist titles, including lists with no entries.

Additional ONIX fields (notes and issue-added, issue-modified, and issue-deprecated values) are retained in `data/generated/codelists.json` for future expansion, while the ONIX public entry API intentionally exposes only `code` and `heading`. Thema’s public entries expose `code`, `heading`, `parentCode`, and `note`.
