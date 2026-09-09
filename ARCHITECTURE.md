# ONIX Engine Architecture

## Direction

This project is evolving from an ONIX classifications package into a general-purpose ONIX for Books implementation library. It should allow consumers to use the codelists independently or opt into a complete standards-based ONIX engine.

EDItEUR is the authoritative source for ONIX. BIC is a useful UK-facing resource that links to EDItEUR material, but does not own or maintain the standard.

## Source of truth

The target format release and codelist issue are independent versioned inputs:

```ts
{
  onixRelease: "3.1.3",
  codelistIssue: 74,
}
```

The internal ONIX model is derived from the following EDItEUR sources:

```text
EDItEUR ONIX 3.1.3
├── XSD / RNG schema      XML elements, composites, ordering, cardinality, attributes
├── Specification          semantics and usage rules
├── Codelists              controlled values and code lifecycle information
└── Best Practice Guide    additional implementation rules
```

The XML schema is necessary but not sufficient for validation. The internal model must represent rules from the specification and Best Practice Guide that cannot be expressed by the schema.

## Versioning and validation

Codelists are updated independently of the ONIX message format. Preserve each codelist and code's added, modified, deprecated, element-usage, and ONIX-release applicability information in the internal model. A code can remain present in the current codelist issue while being unavailable to a particular ONIX release.

Validation has two layers:

1. Generated structural validation from the release schema: XML shape, order, cardinality, and attributes (`validateOnixMessage`).
2. Handwritten semantic validation from the specification, codelists, and Best Practice Guide: usage restrictions, cross-field rules, and release-specific constraints (`validateOnixCodes` / `validateOnixXml`).

## Public modules

```text
onix-engine
├── (root)         Codelists, Thema, subjects helpers, and re-exported engine APIs
├── ./schema       Generated ONIX 3.1.3 intermediate representation
├── ./validation   Structural and semantic validation
├── ./xml          ONIX XML parse and serialize
└── ./builders     Schema-shaped message and product builders
```

The codelists module remains independently useful. The engine modules provide standards-based ONIX construction, validation, and XML I/O without requiring applications to use the entire toolkit.

Applications that export a single product map their own domain model to the canonical `OnixMessage` and call `serializeOnixXml`. This package does not define an application-specific product DTO.

## Proprietary and raw XML data

Only proprietary values permitted at explicitly defined ONIX extension points are standards-compliant. The library may provide a deliberately unsafe raw-XML escape hatch for exceptional integration needs, but it must never be reported as validated or standards-compliant ONIX.
