import {
  getCodelistEntry,
  getCodelistEntries,
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

const draftForm = document.querySelector<HTMLFormElement>("#draft-form");
const compositionInput = document.querySelector<HTMLInputElement>(
  "#product-composition",
);
const formInput = document.querySelector<HTMLInputElement>("#product-form");
const detailFields = document.querySelector<HTMLElement>("#detail-fields");
const addDetail = document.querySelector<HTMLButtonElement>("#add-detail");
const versions = document.querySelector<HTMLElement>("#versions");
const reportGroups = document.querySelector<HTMLElement>("#report-groups");

if (
  !draftForm ||
  !compositionInput ||
  !formInput ||
  !detailFields ||
  !addDetail ||
  !versions ||
  !reportGroups
) {
  throw new Error("The validation demo could not find its required elements.");
}

const fieldFeedback = {
  productComposition: requiredField("productComposition"),
  productForm: requiredField("productForm"),
};
const details: DetailField[] = [];

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
  const findings = document.createElement("div");
  findings.className = "field-findings";
  findings.setAttribute("aria-live", "polite");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-detail";
  remove.textContent = "Remove";

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

  const input: OnixCodeInput = {
    ...(productComposition ? { productComposition } : {}),
    ...(productForm ? { productForm } : {}),
    ...(suppliedDetails.length
      ? { productFormDetails: suppliedDetails.map(({ value }) => value) }
      : {}),
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
compositionInput.addEventListener("input", render);
formInput.addEventListener("input", render);
addDetail.addEventListener("click", () => {
  createDetail();
  render();
});
render();
