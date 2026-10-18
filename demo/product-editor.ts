import { onixEditorSchema } from "../src/generated/onix-editor-schema.js";
import { getList } from "../src/codelists.js";

type Particle = { kind: string; name?: string; minOccurs: number; maxOccurs: number | null; children?: Particle[] };
type Element = { particles: Particle[]; attributes: { name: string; use?: string }[]; simple: boolean; codelist?: number };
const schema = onixEditorSchema as unknown as Record<string, Element>;
const prop = (name: string) => name[0]!.toLowerCase() + name.slice(1);
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const title = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

function choiceFields(p: Particle): string[] {
  const names: string[] = [];
  const visit = (particle: Particle) => {
    if (particle.kind === "element" && particle.name) names.push(title(particle.name));
    else (particle.children ?? []).forEach(visit);
  };
  visit(p);
  return names;
}

function control(name: string): string {
  const e = schema[name];
  const label = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  const list = e?.codelist ? getList(e.codelist) : undefined;
  const input = list ? `<select data-value><option value="">Choose ${esc(label.toLowerCase())}…</option>${list.entries.map((entry) => `<option value="${esc(entry.code)}" title="${esc(`${entry.code} — ${entry.heading}`)}">${esc(entry.code)} — ${esc(entry.heading)}</option>`).join("")}</select>` : `<input data-value />`;
  const attributes = (e?.attributes ?? []).filter((a) => !["refname", "shortname", "datestamp", "sourcename", "sourcetype"].includes(a.name));
  return `<label>${esc(label)}${input}${attributes.map((a) => `<span>${esc(a.name)}<input data-attr="${esc(a.name)}" /></span>`).join("")}</label>`;
}
function element(name: string, min = 1, max: number | null = 1): string {
  const e = schema[name];
  if (!e) return "";
  const content = e.simple ? control(name) : (e.particles[0]?.children ?? []).map((p) => renderParticle(p)).join("");
  const title = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `<fieldset data-element="${esc(prop(name))}" data-repeat="${max === null || max > 1}" data-required="${min > 0}">${e.simple ? "" : `<legend>${esc(title)}</legend>`}${content}${max === null || max > 1 ? `<button type="button" data-clone>Add ${esc(title.toLowerCase())}</button><button type="button" data-remove>Remove</button>` : ""}</fieldset>`;
}
function renderParticle(p: Particle): string {
  if (p.kind === "element" && p.name) return element(p.name, p.minOccurs, p.maxOccurs);
  if (p.kind === "choice") {
    const choices = p.children ?? [];
    const options = choices.map((choice, index) => {
      const fields = choiceFields(choice);
      return `<option value="${index}">${esc(fields.length ? fields.join(" + ") : `Alternative ${index + 1}`)}</option>`;
    }).join("");
    return `<div class="schema-choice" data-choice><label class="choice-label">Choose an alternative<select data-choice-select aria-label="Choose an alternative">${options}</select></label>${choices.map((choice, index) => `<div data-choice-branch${index === 0 ? "" : " hidden"}>${renderParticle(choice)}</div>`).join("")}</div>`;
  }
  return (p.children ?? []).map((child) => renderParticle(child)).join("");
}

export function mountSchemaEditor(root: HTMLElement, elementName: "Header" | "Product"): void {
  const node = schema[elementName];
  const top = node.particles[0]!.children ?? [];
  root.insertAdjacentHTML("beforeend", top.map((p) => renderParticle(p)).join(""));
  if (elementName === "Header") {
    const sentDate = root.querySelector<HTMLInputElement>('[data-element="sentDateTime"] [data-value]');
    if (sentDate) sentDate.value = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const senderName = root.querySelector<HTMLInputElement>('[data-element="senderName"] [data-value]');
    if (senderName) senderName.value = "ONIX Engine demo";
  }
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-clone]")) {
      const field = target.closest("fieldset")!;
      const clone = field.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input").forEach((input) => { input.value = ""; });
      field.parentElement!.insertBefore(clone, field.nextSibling);
    }
    if (target.matches("[data-remove]")) target.closest("fieldset")?.remove();
  });
  root.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches("[data-choice-select]")) return;
    const choice = target.closest<HTMLElement>("[data-choice]");
    if (!choice) return;
    choice.querySelectorAll<HTMLElement>("[data-choice-branch]").forEach((branch, index) => {
      branch.hidden = index !== Number((target as HTMLSelectElement).value);
    });
  });
}

export function readProductEditor(root: HTMLElement): Record<string, unknown> {
  const read = (container: HTMLElement): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const fields = [...container.querySelectorAll<HTMLFieldSetElement>("fieldset[data-element]")].filter((field) => field.parentElement?.closest("fieldset[data-element]") === container.closest("fieldset[data-element]") && !field.closest("[data-choice-branch][hidden]"));
    fields.forEach((child) => {
      const key = child.dataset.element!;
      const nested = read(child);
      const valueControl = child.querySelector<HTMLInputElement | HTMLSelectElement>(":scope > label > [data-value]");
      const attrs = Object.fromEntries([...child.querySelectorAll<HTMLInputElement>("input[data-attr]")].filter((x) => x.value.trim()).map((x) => [x.dataset.attr!, x.value.trim()]));
      const value = valueControl?.value.trim();
      const node = value ? { $value: value, ...(Object.keys(attrs).length ? { $attributes: attrs } : {}) } : Object.keys(attrs).length ? { $attributes: attrs } : nested;
      if (typeof node === "object" && !Array.isArray(node) && !Object.keys(node).length) return;
      if (child.dataset.repeat === "true") {
        const values = (result[key] as unknown[] | undefined) ?? [];
        values.push(node);
        result[key] = values;
      }
      else if (result[key] === undefined) result[key] = node;
    });
    return result;
  };
  return read(root);
}
