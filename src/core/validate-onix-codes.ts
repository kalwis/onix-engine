import { metadata } from "../generated/metadata.js";
import { themaEntriesByCode } from "../generated/thema.js";
import { themaMetadata } from "../generated/thema-metadata.js";
import { getCodelistEntry } from "./get-codelist-entry.js";
import { semanticManifest } from "./semantic-manifest.js";
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
): ValidationFinding => ({
  ruleId,
  severity: "error",
  path,
  source,
  parameters,
});

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
