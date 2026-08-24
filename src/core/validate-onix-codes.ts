import { metadata } from "../generated/metadata.js";
import { themaEntriesByCode } from "../generated/thema.js";
import { themaMetadata } from "../generated/thema-metadata.js";
import { getCodelistEntry } from "./get-codelist-entry.js";
import { semanticManifest } from "./semantic-manifest.js";
import {
  deprecatedIdentifierTypes,
  identifierContextRegistry,
} from "../generated/semantic-manifest.js";
import type {
  OnixCodeInput,
  OnixSubjectAssignment,
  ValidateOnixCodesOptions,
  ValidationFinding,
  ValidationFieldReport,
  ValidationReport,
  ValidationSource,
} from "../types/validation.js";

const versions = Object.freeze({
  onixRelease: "3.1.3",
  codelistIssue: metadata.issue,
  themaVersion: themaMetadata.version,
  semanticRulesVersion: "1.0.0",
});
const listSource = (list: number): ValidationSource => ({
  type: "codelist-note",
  list,
  text: `ONIX Code List ${list}`,
});
const finding = (
  ruleId: string,
  path: string,
  source: ValidationSource,
  parameters: ValidationFinding["parameters"],
  severity: ValidationFinding["severity"] = "error",
): ValidationFinding => ({
  ruleId,
  severity,
  path,
  source,
  parameters,
});

function isMod10(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  return (
    [...value]
      .reverse()
      .reduce(
        (sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1),
        0,
      ) %
      10 ===
    0
  );
}
function isIsbn10(value: string): boolean {
  return (
    /^\d{9}[\dXx]$/.test(value) &&
    [...value.toUpperCase()].reduce(
      (sum, digit, index) =>
        sum + (digit === "X" ? 10 : Number(digit)) * (10 - index),
      0,
    ) %
      11 ===
      0
  );
}
function validIdentifierValue(
  typeCode: string,
  value: string,
): boolean | undefined {
  // List 5 rules are explicit XSD/Schematron assertions, retained here as a
  // small reviewed interpreter rather than prose-derived behaviour.
  if (["03", "14", "15", "25"].includes(typeCode))
    return /^\d{13}$/.test(value) && isMod10(value);
  if (typeCode === "02") return isIsbn10(value);
  if (typeCode === "05")
    return /^M\d{9}$/i.test(value) && isIsbn10(`3${value.slice(1)}`);
  if (typeCode === "04") return /^\d{12}$/.test(value) && isMod10(value);
  if (typeCode === "30")
    return /^\d{17}$/.test(value) && isMod10(value.slice(0, 12));
  if (typeCode === "06" || typeCode === "26")
    return typeCode === "26"
      ? /^10\.97[89]\./i.test(value) && value.includes("/")
      : /^10\.\d{4,9}\/.+$/i.test(value);
  return undefined;
}
function validateIdentifierGroups(input: OnixCodeInput): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const group of input.identifierGroups ?? []) {
    const context = identifierContextRegistry.find(
      (entry) => entry.context === group.context,
    );
    if (!context) {
      findings.push(
        finding(
          "ONIX-IDENTIFIER-CONTEXT",
          group.path,
          { type: "schema", text: "Generated identifier-context registry" },
          { context: group.context },
        ),
      );
      continue;
    }
    const seen = new Set<string>();
    for (const [index, identifier] of group.identifiers.entries()) {
      const base = `${group.path}/${index}`;
      const source: ValidationSource = {
        type: "schema",
        rule: context.source.id,
        text: `${context.context} uses ONIX Code List ${context.typeList}`,
      };
      if (!getCodelistEntry(context.typeList, identifier.typeCode))
        findings.push(
          finding(
            `ONIX-${context.typeList}-IDENTIFIER-TYPE`,
            `${base}/typeCode`,
            source,
            { context: context.context, typeCode: identifier.typeCode },
          ),
        );
      const proprietary =
        identifier.typeCode === "01" || identifier.typeCode === "02";
      if (proprietary && !identifier.typeName?.trim())
        findings.push(
          finding(
            "ONIX-IDENTIFIER-PROPRIETARY-NAME",
            `${base}/typeName`,
            source,
            { context: context.context, typeCode: identifier.typeCode },
          ),
        );
      const tuple = `${identifier.typeCode}\u0000${identifier.typeName ?? ""}\u0000${identifier.value}`;
      if (seen.has(tuple))
        findings.push(
          finding("ONIX-IDENTIFIER-DUPLICATE", `${base}/value`, source, {
            context: context.context,
            typeCode: identifier.typeCode,
            value: identifier.value,
          }),
        );
      seen.add(tuple);
      const valid =
        context.typeList === 5
          ? validIdentifierValue(identifier.typeCode, identifier.value)
          : undefined;
      if (valid === false)
        findings.push(
          finding("ONIX-IDENTIFIER-VALUE", `${base}/value`, source, {
            context: context.context,
            typeCode: identifier.typeCode,
            value: identifier.value,
          }),
        );
      const deprecated = deprecatedIdentifierTypes.find(
        (entry) =>
          entry.context === context.context &&
          entry.code === identifier.typeCode,
      );
      if (deprecated)
        findings.push(
          finding(
            "ONIX-IDENTIFIER-DEPRECATED",
            `${base}/typeCode`,
            {
              type: "codelist-note",
              list: context.typeList,
              code: identifier.typeCode,
              text:
                deprecated.note ??
                `Deprecated in Issue ${deprecated.issueDeprecated}`,
            },
            {
              context: context.context,
              typeCode: identifier.typeCode,
              issueDeprecated: deprecated.issueDeprecated,
            },
            "warning",
          ),
        );
    }
    if (context.context === "ProductIdentifier") {
      const typeCodes = new Set(
        group.identifiers.map((identifier) => identifier.typeCode),
      );
      for (const [index, identifier] of group.identifiers.entries()) {
        const companion =
          identifier.typeCode === "02" || identifier.typeCode === "26"
            ? ["03", "15"]
            : identifier.typeCode === "05"
              ? ["25"]
              : undefined;
        if (companion && !companion.some((code) => typeCodes.has(code)))
          findings.push(
            finding(
              "ONIX-PRODUCT-IDENTIFIER-COMPANION",
              `${group.path}/${index}/typeCode`,
              {
                type: "codelist-note",
                list: 5,
                code: identifier.typeCode,
                text: "Official List 5 identifier companion guidance",
              },
              {
                typeCode: identifier.typeCode,
                requiredCompanionTypes: companion,
              },
            ),
          );
      }
    }
  }
  return findings;
}

export function createValidationReport(
  findings: readonly ValidationFinding[],
): ValidationReport {
  const findingsByPath: Record<string, readonly ValidationFinding[]> = {};
  for (const item of findings) {
    const atPath = findingsByPath[item.path];
    findingsByPath[item.path] = Object.freeze(
      atPath ? [...atPath, item] : [item],
    );
  }
  return Object.freeze({
    findings: Object.freeze([...findings]),
    findingsByPath: Object.freeze(findingsByPath),
    versions,
  });
}

function isAncestor(ancestor: string, descendant: string): boolean {
  let current = themaEntriesByCode.get(descendant);
  while (current?.parentCode) {
    if (current.parentCode === ancestor) return true;
    current = themaEntriesByCode.get(current.parentCode);
  }
  return false;
}

function validateSubjects(
  subjects: readonly OnixSubjectAssignment[],
  options: ValidateOnixCodesOptions,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const seen = new Set<string>();
  const mains = new Set<string>();
  for (const [index, subject] of subjects.entries()) {
    const path = `/subjects/${index}`;
    if (!getCodelistEntry(27, subject.schemeCode))
      findings.push(
        finding("ONIX-27-SCHEME", `${path}/schemeCode`, listSource(27), {
          schemeCode: subject.schemeCode,
        }),
      );
    const key = `${subject.schemeCode}\u0000${subject.code}`;
    if (seen.has(key))
      findings.push(
        finding(
          "ONIX-SUBJECT-DUPLICATE",
          path,
          { type: "thema", text: "Duplicate subject assignment" },
          { schemeCode: subject.schemeCode, code: subject.code },
        ),
      );
    seen.add(key);
    if (subject.isMain) {
      if (mains.has(subject.schemeCode))
        findings.push(
          finding(
            "ONIX-SUBJECT-MULTIPLE-MAIN",
            `${path}/isMain`,
            { type: "thema", text: "At most one main subject per scheme" },
            { schemeCode: subject.schemeCode },
          ),
        );
      mains.add(subject.schemeCode);
    }
    if (subject.schemeCode >= "93" && subject.schemeCode <= "99") {
      const entry = themaEntriesByCode.get(subject.code);
      if (!entry)
        findings.push(
          finding(
            "THEMA-CODE",
            `${path}/code`,
            { type: "thema", text: "Thema v1.6 hierarchy" },
            { schemeCode: subject.schemeCode, code: subject.code },
          ),
        );
      else {
        const root =
          entry.code === "1" ||
          entry.code === "2" ||
          entry.code === "3" ||
          entry.code === "4" ||
          entry.code === "5" ||
          entry.code === "6"
            ? entry.code
            : rootOf(entry.code);
        const expected =
          root && root >= "1" && root <= "6" ? String(93 + Number(root)) : "93";
        if (subject.schemeCode !== expected)
          findings.push(
            finding(
              "THEMA-SCHEME-ELIGIBILITY",
              `${path}/schemeCode`,
              { type: "thema", text: "Thema root classification" },
              {
                code: subject.code,
                schemeCode: subject.schemeCode,
                expectedSchemeCode: expected,
              },
            ),
          );
      }
    }
  }
  if (options.rejectAncestorDescendant)
    for (let i = 0; i < subjects.length; i++)
      for (let j = i + 1; j < subjects.length; j++) {
        const a = subjects[i],
          b = subjects[j];
        if (
          a.schemeCode === b.schemeCode &&
          themaEntriesByCode.has(a.code) &&
          themaEntriesByCode.has(b.code) &&
          (isAncestor(a.code, b.code) || isAncestor(b.code, a.code))
        )
          findings.push(
            finding(
              "THEMA-ANCESTOR-DESCENDANT",
              `/subjects/${j}`,
              { type: "thema", text: "Selectable Thema best-practice policy" },
              {
                schemeCode: a.schemeCode,
                firstCode: a.code,
                secondCode: b.code,
              },
            ),
          );
      }
  return findings;
}

function rootOf(code: string): string | undefined {
  let entry = themaEntriesByCode.get(code);
  while (entry?.parentCode) entry = themaEntriesByCode.get(entry.parentCode);
  return entry?.code;
}

export function validateOnixCodes(
  input: OnixCodeInput,
  options: ValidateOnixCodesOptions = {},
): ValidationReport {
  const findings: ValidationFinding[] = [];
  for (const [field, list] of [
    ["productComposition", 2],
    ["productForm", 150],
  ] as const) {
    const value = input[field];
    if (value !== undefined && !getCodelistEntry(list, value))
      findings.push(
        finding(`ONIX-${list}-CODE`, `/${field}`, listSource(list), {
          code: value,
        }),
      );
  }
  for (const [index, detail] of (input.productFormDetails ?? []).entries()) {
    const path = `/productFormDetails/${index}`;
    if (!getCodelistEntry(175, detail))
      findings.push(
        finding("ONIX-175-CODE", path, listSource(175), { code: detail }),
      );
    if (input.productForm !== undefined)
      for (const rule of semanticManifest) {
        if (
          rule.enforcement !== "none" &&
          rule.predicate.kind === "product-form-detail-requires-form"
        ) {
          const p = rule.predicate as {
            details: readonly string[];
            allowedForms: readonly string[];
            allowedFormPrefixes?: readonly string[];
            requiredDetails?: readonly string[];
          };
          if (
            p.details.includes(detail) &&
            !p.allowedForms.includes(input.productForm) &&
            !p.allowedFormPrefixes?.some((prefix) =>
              input.productForm?.startsWith(prefix),
            )
          )
            findings.push(
              finding(rule.ruleId, path, rule.source, {
                detail,
                productForm: input.productForm,
                allowedForms: p.allowedForms,
              }),
            );
          if (
            p.details.includes(detail) &&
            p.requiredDetails &&
            !input.productFormDetails?.some((value) =>
              p.requiredDetails?.includes(value),
            )
          )
            findings.push(
              finding(rule.ruleId, path, rule.source, {
                detail,
                requiredDetails: p.requiredDetails,
              }),
            );
        }
      }
  }
  if (
    input.productForm !== undefined &&
    input.productComposition !== undefined
  ) {
    for (const rule of semanticManifest) {
      if (
        rule.enforcement !== "none" &&
        rule.predicate.kind === "product-form-requires-composition"
      ) {
        const predicate = rule.predicate as {
          forms: readonly string[];
          allowedCompositions: readonly string[];
        };
        if (
          predicate.forms.includes(input.productForm) &&
          !predicate.allowedCompositions.includes(input.productComposition)
        ) {
          findings.push(
            finding(rule.ruleId, "/productComposition", rule.source, {
              productForm: input.productForm,
              productComposition: input.productComposition,
              allowedCompositions: predicate.allowedCompositions,
            }),
          );
        }
      }
    }
  }
  if (input.subjects)
    findings.push(...validateSubjects(input.subjects, options));
  findings.push(...validateIdentifierGroups(input));
  return createValidationReport(findings);
}

export function validateOnixField(
  input: OnixCodeInput,
  path: string,
  options: ValidateOnixCodesOptions = {},
): ValidationFieldReport {
  const report = validateOnixCodes(input, options);
  return Object.freeze({
    path,
    findings: report.findingsByPath[path] ?? Object.freeze([]),
    versions: report.versions,
  });
}

export function validateProductForm(
  input: Pick<
    OnixCodeInput,
    "productComposition" | "productForm" | "productFormDetails"
  >,
): ValidationReport {
  return validateOnixCodes(input);
}
export function validateThemaAssignments(
  assignments: readonly OnixSubjectAssignment[],
  options: ValidateOnixCodesOptions = {},
): ValidationReport {
  return validateOnixCodes({ subjects: assignments }, options);
}
