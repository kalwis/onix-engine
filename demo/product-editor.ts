import { onixEditorSchema } from "../src/generated/onix-editor-schema.js";
import { getList } from "../src/codelists.js";

type Particle = {
  kind: string;
  name?: string;
  minOccurs: number;
  maxOccurs: number | null;
  children?: Particle[];
};
type Element = {
  particles: Particle[];
  attributes: { name: string; use?: string }[];
  simple: boolean;
  codelist?: number;
  multiple?: boolean;
};
const schema = onixEditorSchema as unknown as Record<string, Element>;
const prop = (name: string) => name[0]!.toLowerCase() + name.slice(1);
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const title = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

function choiceFields(p: Particle): string[] {
  const names: string[] = [];
  const visit = (particle: Particle) => {
    if (particle.kind === "element" && particle.name)
      names.push(title(particle.name));
    else (particle.children ?? []).forEach(visit);
  };
  visit(p);
  return names;
}

function control(name: string): string {
  const e = schema[name];
  const label = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  const list = e?.codelist ? getList(e.codelist) : undefined;
  const attributes = (e?.attributes ?? []).filter(
    (a) =>
      ![
        "refname",
        "shortname",
        "datestamp",
        "sourcename",
        "sourcetype",
      ].includes(a.name),
  );
  if (list && e.multiple)
    return `<div class="code-multiselect" data-value data-multiple><span class="field-label">${esc(label)}</span><input type="search" data-code-search placeholder="Filter ${esc(label.toLowerCase())}…" aria-label="Filter ${esc(label.toLowerCase())}" /><div data-code-options role="group" aria-label="Choose one or more ${esc(label.toLowerCase())}">${list.entries.map((entry) => `<label class="code-option"><input type="checkbox" data-code-option value="${esc(entry.code)}" /><span>${esc(entry.code)} — ${esc(entry.heading)}</span></label>`).join("")}</div>${attributes.map((a) => `<span>${esc(a.name)}<input data-attr="${esc(a.name)}" /></span>`).join("")}</div>`;
  const input = list
    ? `<select data-value><option value="">Choose ${esc(label.toLowerCase())}…</option>${list.entries.map((entry) => `<option value="${esc(entry.code)}" title="${esc(`${entry.code} — ${entry.heading}`)}">${esc(entry.code)} — ${esc(entry.heading)}</option>`).join("")}</select>`
    : `<input data-value />`;
  return `<label>${esc(label)}${input}${attributes.map((a) => `<span>${esc(a.name)}<input data-attr="${esc(a.name)}" /></span>`).join("")}</label>`;
}

function valueControl(field: HTMLFieldSetElement): HTMLElement | null {
  return field.querySelector<HTMLElement>(
    ":scope > label > [data-value], :scope > [data-value]",
  );
}
function element(name: string, min = 1, max: number | null = 1): string {
  const e = schema[name];
  if (!e) return "";
  const content = e.simple
    ? control(name)
    : (e.particles[0]?.children ?? []).map((p) => renderParticle(p)).join("");
  const title = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `<fieldset data-element="${esc(prop(name))}" data-repeat="${max === null || max > 1}" data-required="${min > 0}">${e.simple ? "" : `<legend>${esc(title)}</legend>`}${content}${max === null || max > 1 ? `<button type="button" data-clone>Add ${esc(title.toLowerCase())}</button><button type="button" data-remove>Remove</button>` : ""}</fieldset>`;
}
function renderParticle(p: Particle): string {
  if (p.kind === "element" && p.name)
    return element(p.name, p.minOccurs, p.maxOccurs);
  if (p.kind === "choice") {
    const choices = p.children ?? [];
    const options = choices
      .map((choice, index) => {
        const fields = choiceFields(choice);
        return `<option value="${index}">${esc(fields.length ? fields.join(" + ") : `Alternative ${index + 1}`)}</option>`;
      })
      .join("");
    return `<div class="schema-choice" data-choice><label class="choice-label">Choose an alternative<select data-choice-select aria-label="Choose an alternative">${options}</select></label>${choices.map((choice, index) => `<div data-choice-branch${index === 0 ? "" : " hidden"}>${renderParticle(choice)}</div>`).join("")}</div>`;
  }
  return (p.children ?? []).map((child) => renderParticle(child)).join("");
}

export function mountSchemaEditor(
  root: HTMLElement,
  elementName: "Header" | "Product",
): void {
  const node = schema[elementName];
  const top = node.particles[0]!.children ?? [];
  root.insertAdjacentHTML(
    "beforeend",
    top.map((p) => renderParticle(p)).join(""),
  );
  if (elementName === "Header") {
    const sentDate = root.querySelector<HTMLInputElement>(
      '[data-element="sentDateTime"] [data-value]',
    );
    if (sentDate)
      sentDate.value = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");
    const senderName = root.querySelector<HTMLInputElement>(
      '[data-element="senderName"] [data-value]',
    );
    if (senderName) senderName.value = "ONIX Engine demo";
  }
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-clone]")) {
      const field = target.closest("fieldset")!;
      const clone = field.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input").forEach((input) => {
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          input.checked = false;
        } else input.value = "";
      });
      clone.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
        if (select.multiple)
          [...select.options].forEach((option) => {
            option.selected = false;
          });
        else select.selectedIndex = 0;
      });
      field.parentElement!.insertBefore(clone, field.nextSibling);
    }
    if (target.matches("[data-remove]")) target.closest("fieldset")?.remove();
  });
  root.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches("[data-choice-select]")) return;
    const choice = target.closest<HTMLElement>("[data-choice]");
    if (!choice) return;
    choice
      .querySelectorAll<HTMLElement>("[data-choice-branch]")
      .forEach((branch, index) => {
        if (branch.closest("[data-choice]") === choice)
          branch.hidden = index !== Number((target as HTMLSelectElement).value);
      });
  });
  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (!target.matches("[data-code-search]")) return;
    const options = target.parentElement?.querySelector<HTMLElement>(
      "[data-code-options]",
    );
    if (!options) return;
    const query = target.value.trim().toLocaleLowerCase();
    options.querySelectorAll<HTMLElement>(".code-option").forEach((option) => {
      option.hidden =
        Boolean(query) &&
        !option.textContent!.toLocaleLowerCase().includes(query);
    });
  });
}

export function readProductEditor(root: HTMLElement): Record<string, unknown> {
  const read = (container: HTMLElement): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const fields = [
      ...container.querySelectorAll<HTMLFieldSetElement>(
        "fieldset[data-element]",
      ),
    ].filter(
      (field) =>
        field.parentElement?.closest("fieldset[data-element]") ===
          container.closest("fieldset[data-element]") &&
        !field.closest("[data-choice-branch][hidden]"),
    );
    fields.forEach((child) => {
      const key = child.dataset.element!;
      const nested = read(child);
      const control = valueControl(child);
      const attrs = Object.fromEntries(
        [...child.querySelectorAll<HTMLInputElement>("input[data-attr]")]
          .filter(
            (x) =>
              x.closest("fieldset[data-element]") === child && x.value.trim(),
          )
          .map((x) => [x.dataset.attr!, x.value.trim()]),
      );
      const value =
        control instanceof HTMLSelectElement && control.multiple
          ? [...control.selectedOptions]
              .map((option) => option.value)
              .join(" ")
          : control?.dataset.multiple === ""
            ? [...control.querySelectorAll<HTMLInputElement>("[data-code-option]:checked")]
                .map((input) => input.value)
                .join(" ")
            : control instanceof HTMLInputElement
              ? control.value.trim()
              : undefined;
      const node = value
        ? {
            $value: value,
            ...(Object.keys(attrs).length ? { $attributes: attrs } : {}),
          }
        : Object.keys(attrs).length
          ? { $attributes: attrs }
          : nested;
      if (
        typeof node === "object" &&
        !Array.isArray(node) &&
        !Object.keys(node).length
      )
        return;
      if (child.dataset.repeat === "true") {
        const values = (result[key] as unknown[] | undefined) ?? [];
        values.push(node);
        result[key] = values;
      } else if (result[key] === undefined) result[key] = node;
    });
    return result;
  };
  return read(root);
}

function clearEditor(root: HTMLElement): void {
  const directFields = [...root.querySelectorAll<HTMLFieldSetElement>(
    ":scope > fieldset[data-element]",
  )];
  const seen = new Set<string>();
  for (const field of directFields) {
    const key = field.dataset.element!;
    if (seen.has(key) && field.dataset.repeat === "true") {
      field.remove();
      continue;
    }
    seen.add(key);
    if (field.dataset.repeat === "true") {
      let next = field.nextElementSibling;
      while (next instanceof HTMLFieldSetElement && next.dataset.element === key) {
        const after = next.nextElementSibling;
        next.remove();
        next = after;
      }
    }
    field.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      if (input.type === "checkbox") input.checked = false;
      else input.value = "";
    });
    field.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
      if (select.multiple)
        [...select.options].forEach((option) => (option.selected = false));
      else select.selectedIndex = 0;
    });
    field.querySelectorAll<HTMLElement>("[data-choice]").forEach((choice) => {
      const select = choice.querySelector<HTMLSelectElement>("[data-choice-select]");
      if (select) select.selectedIndex = 0;
      choice.querySelectorAll<HTMLElement>("[data-choice-branch]").forEach((branch, index) => {
        branch.hidden = index !== 0;
      });
    });
    clearEditor(field);
  }
}

function directEditorFields(root: HTMLElement): HTMLFieldSetElement[] {
  return [...root.querySelectorAll<HTMLFieldSetElement>(
    ":scope > fieldset[data-element]",
  )];
}

function setFieldValue(field: HTMLFieldSetElement, source: Element): void {
  const control = valueControl(field);
  if (control instanceof HTMLSelectElement && control.multiple) {
    const selected = new Set(source.textContent?.trim().split(/\s+/) ?? []);
    [...control.options].forEach((option) => {
      option.selected = selected.has(option.value);
    });
  } else if (control?.dataset.multiple === "") {
    const selected = new Set(source.textContent?.trim().split(/\s+/) ?? []);
    control.querySelectorAll<HTMLInputElement>("[data-code-option]").forEach((input) => {
      input.checked = selected.has(input.value);
    });
  } else if (control instanceof HTMLInputElement) {
    control.value = source.textContent?.trim() ?? "";
  }
  field.querySelectorAll<HTMLInputElement>("input[data-attr]").forEach((input) => {
    if (input.closest("fieldset[data-element]") === field)
      input.value = source.getAttribute(input.dataset.attr!) ?? "";
  });
}

function populateEditor(root: HTMLElement, source: Element): void {
  const sourceChildren = [...source.children];
  const fields = directEditorFields(root);
  const groups = new Map<string, Element[]>();
  for (const child of sourceChildren) {
    const key = prop(child.tagName);
    const group = groups.get(key) ?? [];
    group.push(child);
    groups.set(key, group);
  }

  for (const [key, nodes] of groups) {
    const templates = fields.filter((field) => field.dataset.element === key);
    if (!templates.length) continue;
    const template = templates[0]!;
    const instances = [template];
    if (template.dataset.repeat === "true") {
      for (let index = 1; index < nodes.length; index++) {
        const clone = template.cloneNode(true) as HTMLFieldSetElement;
        template.parentElement!.insertBefore(clone, instances.at(-1)!.nextSibling);
        instances.push(clone);
      }
    }
    nodes.forEach((node, index) => {
      const field = instances[index];
      if (!field) return;
      const branchNodes = [...field.querySelectorAll<HTMLElement>("[data-choice]")].filter(
        (choice) => choice.closest("fieldset[data-element]") === field,
      );
      for (const choice of branchNodes) {
        const branches = [...choice.querySelectorAll<HTMLElement>(":scope > [data-choice-branch]")];
        let bestIndex = -1;
        let bestScore = 0;
        branches.forEach((branch, branchIndex) => {
          const expected = directEditorFields(branch);
          const score = expected.reduce(
            (total, expectedField) => total + (node.children ? [...node.children].some((child) => prop(child.tagName) === expectedField.dataset.element) ? 1 : 0 : 0),
            0,
          );
          if (score > bestScore) {
            bestScore = score;
            bestIndex = branchIndex;
          }
        });
        if (bestIndex >= 0) {
          const select = choice.querySelector<HTMLSelectElement>("[data-choice-select]");
          if (select) select.value = String(bestIndex);
          branches.forEach((branch, index) => (branch.hidden = index !== bestIndex));
        }
      }
      const schemaName = key[0]!.toUpperCase() + key.slice(1);
      if (schema[schemaName]?.simple) setFieldValue(field, node);
      else populateEditor(field, node);
    });
  }
}

export function fillEditorFromSample(
  headerRoot: HTMLElement,
  productRoot: HTMLElement,
  sample: Document,
): void {
  const parserError = sample.querySelector("parsererror");
  const header = sample.getElementsByTagName("Header")[0];
  const product = sample.getElementsByTagName("Product")[0];
  if (parserError || !header || !product)
    throw new Error("The sample ONIX file could not be read.");
  clearEditor(headerRoot);
  clearEditor(productRoot);
  populateEditor(headerRoot, header);
  populateEditor(productRoot, product);
}
