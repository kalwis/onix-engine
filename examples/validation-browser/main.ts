import {
  getCodelistEntries,
  getCodelistEntry,
  getThemaEntries,
  isThemaCodeAssignable,
  validateOnixCodes,
  validateOnixField,
} from "../../src/index.ts";
import type { OnixCodeInput, ValidationFinding } from "../../src/index.ts";
import "./style.css";

interface DetailField {
  readonly input: HTMLInputElement;
  readonly path: HTMLElement;
  readonly findings: HTMLElement;
}

interface SubjectField {
  readonly field: HTMLElement;
  readonly scheme: HTMLSelectElement;
  readonly code: HTMLSelectElement;
  readonly isMain: HTMLInputElement;
  readonly path: HTMLElement;
  readonly schemeFindings: HTMLElement;
  readonly codeFindings: HTMLElement;
  readonly mainFindings: HTMLElement;
}

const draftForm = document.querySelector<HTMLFormElement>("#draft-form");
const compositionInput = document.querySelector<HTMLInputElement>(
  "#product-composition",
);
const formInput = document.querySelector<HTMLInputElement>("#product-form");
const detailFields = document.querySelector<HTMLElement>("#detail-fields");
const addDetail = document.querySelector<HTMLButtonElement>("#add-detail");
const subjectFields = document.querySelector<HTMLElement>("#subject-fields");
const addSubject = document.querySelector<HTMLButtonElement>("#add-subject");
const versions = document.querySelector<HTMLElement>("#versions");
const reportGroups = document.querySelector<HTMLElement>("#report-groups");

if (
  !draftForm ||
  !compositionInput ||
  !formInput ||
  !detailFields ||
  !addDetail ||
  !subjectFields ||
  !addSubject ||
  !versions ||
  !reportGroups
)
  throw new Error("The validation demo could not find its required elements.");

const fieldFeedback = {
  productComposition: requiredField("productComposition"),
  productForm: requiredField("productForm"),
};
const details: DetailField[] = [];
const subjects: SubjectField[] = [];
const themaSchemeEntries = getCodelistEntries(27).filter(({ code }) =>
  ["93", "94", "95", "96", "97", "98", "99"].includes(code),
);
const themaEntries = getThemaEntries();
const themaEntriesByCode = new Map(
  themaEntries.map((entry) => [entry.code, entry]),
);
const themaEntriesByScheme = new Map(
  themaSchemeEntries.map(({ code }) => [
    code,
    themaEntries.filter(
      (entry) =>
        themaSchemeFor(entry.code) === code &&
        isThemaCodeAssignable(entry.code),
    ),
  ]),
);

function requiredField(name: string): HTMLElement {
  const field = draftForm.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const findings = field?.querySelector<HTMLElement>(".field-findings");
  if (!findings) throw new Error(`The validation demo is missing ${name}.`);
  return findings;
}

function fillDatalist(id: string, list: number): void {
  const datalist = document.querySelector<HTMLDataListElement>(`#${id}`);
  if (!datalist) throw new Error(`The validation demo is missing ${id}.`);
  datalist.replaceChildren(
    ...getCodelistEntries(list).map(
      ({ code, heading }) => new Option(`${code} — ${heading}`, code),
    ),
  );
}

function themaSchemeFor(code: string): string {
  let entry = themaEntriesByCode.get(code);
  while (entry?.parentCode) entry = themaEntriesByCode.get(entry.parentCode);
  return entry && /^[1-6]$/.test(entry.code)
    ? String(93 + Number(entry.code))
    : "93";
}

function createFindings(): HTMLElement {
  const findings = document.createElement("div");
  findings.className = "field-findings";
  findings.setAttribute("aria-live", "polite");
  return findings;
}

function removeButton(label: string): HTMLButtonElement {
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-control";
  remove.textContent = label;
  return remove;
}

function createDetail(value = ""): void {
  const field = document.createElement("div");
  field.className = "field detail-field";
  const label = document.createElement("label");
  label.textContent = "Product-form detail";
  const input = document.createElement("input");
  input.value = value;
  input.setAttribute("list", "product-form-detail-options");
  input.autocomplete = "off";
  input.placeholder = "e.g. B135";
  const path = document.createElement("p");
  path.className = "field-path";
  const findings = createFindings();
  const remove = removeButton("Remove detail");
  label.append(input);
  field.append(label, path, findings, remove);
  detailFields.append(field);
  const detail = { input, path, findings };
  details.push(detail);
  input.addEventListener("input", render);
  remove.addEventListener("click", () => {
    const index = details.indexOf(detail);
    if (index !== -1) details.splice(index, 1);
    field.remove();
    render();
  });
}

function createSubject(schemeCode = "93", code = "AB"): void {
  const field = document.createElement("fieldset");
  field.className = "subject-field";
  const legend = document.createElement("legend");
  legend.textContent = "Thema subject assignment";
  const controls = document.createElement("div");
  controls.className = "subject-controls";

  const schemeLabel = document.createElement("label");
  schemeLabel.textContent = "Scheme";
  const scheme = document.createElement("select");
  scheme.replaceChildren(
    ...themaSchemeEntries.map(
      ({ code: value, heading }) =>
        new Option(`${value} — ${heading}`, value, false, value === schemeCode),
    ),
  );
  const schemeFindings = createFindings();
  schemeLabel.append(scheme, schemeFindings);

  const codeLabel = document.createElement("label");
  codeLabel.textContent = "Thema code";
  const codeInput = document.createElement("select");
  const codeFindings = createFindings();
  codeLabel.append(codeInput, codeFindings);

  const mainLabel = document.createElement("label");
  mainLabel.className = "main-subject";
  const isMain = document.createElement("input");
  isMain.type = "checkbox";
  isMain.checked = schemeCode === "93";
  mainLabel.append(isMain, document.createTextNode("Main subject"));
  const mainFindings = createFindings();
  mainLabel.append(mainFindings);

  const path = document.createElement("p");
  path.className = "field-path subject-path";
  const remove = removeButton("Remove subject");
  controls.append(schemeLabel, codeLabel, mainLabel);
  field.append(legend, controls, path, remove);
  subjectFields.append(field);
  const subject = {
    field,
    scheme,
    code: codeInput,
    isMain,
    path,
    schemeFindings,
    codeFindings,
    mainFindings,
  };
  updateSubjectCodes(subject, code);
  subjects.push(subject);
  scheme.addEventListener("input", () => {
    updateSubjectCodes(subject);
    if (scheme.value !== "93") isMain.checked = false;
    render();
  });
  for (const control of [codeInput, isMain])
    control.addEventListener("input", render);
  remove.addEventListener("click", () => {
    const index = subjects.indexOf(subject);
    if (index !== -1) subjects.splice(index, 1);
    field.remove();
    render();
  });
}

function updateSubjectCodes(
  subject: SubjectField,
  preferredCode?: string,
): void {
  const entries = themaEntriesByScheme.get(subject.scheme.value) ?? [];
  subject.code.replaceChildren(
    ...entries.map(
      ({ code, heading }) =>
        new Option(`${code} — ${heading}`, code, false, code === preferredCode),
    ),
  );
}

function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function describeFinding(item: ValidationFinding): string {
  const source = item.source.text ?? item.source.type;
  const details = [`${item.severity}: ${item.ruleId}`, `Source: ${source}`];
  const parameters = Object.entries(item.parameters).map(([name, value]) =>
    describeParameter(name, value),
  );
  if (parameters.length > 0)
    details.push(`Parameters: ${parameters.join("; ")}`);
  return details.join(". ");
}

function describeParameter(
  name: string,
  value: string | number | boolean | readonly string[],
): string {
  const label = name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
  if (name === "detail" && typeof value === "string")
    return `${label}: ${describeCode(175, value)}`;
  if (name === "productForm" && typeof value === "string")
    return `${label}: ${describeCode(150, value)}`;
  if (name === "allowedForms" && Array.isArray(value))
    return `${label}: ${value.map((code) => describeCode(150, code)).join(", ")}`;
  if (name === "allowedCompositions" && Array.isArray(value))
    return `${label}: ${value.map((code) => describeCode(2, code)).join(", ")}`;
  return `${label}: ${Array.isArray(value) ? value.join(", ") : value}`;
}

function describeCode(list: number, code: string): string {
  const heading = getCodelistEntry(list, code)?.heading;
  return heading ? `${code} (${heading})` : code;
}

function renderFieldFindings(
  element: HTMLElement,
  findings: readonly ValidationFinding[],
): void {
  element.replaceChildren(
    ...findings.map((item) => {
      const message = document.createElement("p");
      message.textContent = describeFinding(item);
      return message;
    }),
  );
}

function render(): void {
  const productComposition = text(compositionInput.value);
  const productForm = text(formInput.value);
  const suppliedDetails: {
    detail: DetailField;
    value: string;
    path: string;
  }[] = [];
  for (const detail of details) {
    const value = text(detail.input.value);
    if (!value) {
      detail.path.textContent = "Not included until a value is supplied";
      detail.findings.replaceChildren();
      continue;
    }
    const path = `/productFormDetails/${suppliedDetails.length}`;
    suppliedDetails.push({ detail, value, path });
    detail.path.textContent = path;
  }
  const suppliedSubjects: { subject: SubjectField; path: string }[] = [];
  const assignments: { schemeCode: string; code: string; isMain: boolean }[] =
    [];
  for (const subject of subjects) {
    const code = text(subject.code.value);
    if (!code) {
      subject.path.textContent = "Not included until a Thema code is supplied";
      subject.schemeFindings.replaceChildren();
      subject.codeFindings.replaceChildren();
      subject.mainFindings.replaceChildren();
      continue;
    }
    const path = `/subjects/${assignments.length}`;
    assignments.push({
      schemeCode: subject.scheme.value,
      code,
      isMain: subject.isMain.checked,
    });
    suppliedSubjects.push({ subject, path });
    subject.path.textContent = path;
  }
  const input: OnixCodeInput = {
    ...(productComposition ? { productComposition } : {}),
    ...(productForm ? { productForm } : {}),
    ...(suppliedDetails.length
      ? { productFormDetails: suppliedDetails.map(({ value }) => value) }
      : {}),
    ...(assignments.length ? { subjects: assignments } : {}),
  };
  const report = validateOnixCodes(input);
  versions.textContent = `ONIX ${report.versions.onixRelease} · Codelists issue ${report.versions.codelistIssue} · Thema ${report.versions.themaVersion} · Rules ${report.versions.semanticRulesVersion}`;
  const fields = [
    {
      value: productComposition,
      path: "/productComposition",
      findings: fieldFeedback.productComposition,
    },
    {
      value: productForm,
      path: "/productForm",
      findings: fieldFeedback.productForm,
    },
    ...suppliedDetails.map(({ detail, value, path }) => ({
      value,
      path,
      findings: detail.findings,
    })),
  ];
  for (const field of fields)
    renderFieldFindings(
      field.findings,
      field.value ? validateOnixField(input, field.path).findings : [],
    );
  for (const { subject, path } of suppliedSubjects) {
    renderFieldFindings(
      subject.schemeFindings,
      validateOnixField(input, `${path}/schemeCode`).findings,
    );
    renderFieldFindings(
      subject.codeFindings,
      validateOnixField(input, `${path}/code`).findings,
    );
    renderFieldFindings(
      subject.mainFindings,
      validateOnixField(input, `${path}/isMain`).findings,
    );
  }
  if (report.findings.length === 0) {
    reportGroups.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent: "No findings for the supplied draft.",
        className: "clean-report",
      }),
    );
    return;
  }
  reportGroups.replaceChildren(
    ...Object.entries(report.findingsByPath).map(([path, findings]) => {
      const group = document.createElement("section");
      group.className = "finding-group";
      const heading = document.createElement("h3");
      heading.textContent = path;
      const list = document.createElement("ul");
      list.replaceChildren(
        ...findings.map((item) => {
          const entry = document.createElement("li");
          entry.textContent = describeFinding(item);
          return entry;
        }),
      );
      group.append(heading, list);
      return group;
    }),
  );
}

fillDatalist("product-composition-options", 2);
fillDatalist("product-form-options", 150);
fillDatalist("product-form-detail-options", 175);
createDetail("B135");
createSubject("94", "1A");
compositionInput.addEventListener("input", render);
formInput.addEventListener("input", render);
addDetail.addEventListener("click", () => {
  createDetail();
  render();
});
addSubject.addEventListener("click", () => {
  createSubject();
  render();
});
render();
