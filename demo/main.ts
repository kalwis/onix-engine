import { getList } from "../src/codelists.js";
import { createOnixMessage, createProduct } from "../src/builders.js";
import { serializeOnix } from "../src/xml.js";
import type { OnixNode } from "../src/types/onix.js";

type Field = { name: string; label: string; placeholder?: string; wide?: boolean; type?: string; list?: number };
const sections: { title: string; fields: Field[] }[] = [
  { title: "Record & notification", fields: [{name:"recordReference",label:"Record reference",placeholder:"BOOK-001"},{name:"notificationType",label:"Notification type",list:1},{name:"recordSourceType",label:"Record source type",list:3},{name:"recordSourceName",label:"Record source name",placeholder:"Example Publisher"}] },
  { title: "Identifiers", fields: [{name:"isbn",label:"ISBN-13",placeholder:"9780000000000"},{name:"ean",label:"GTIN / EAN",placeholder:"9780000000000"},{name:"proprietaryId",label:"Publisher product ID"},{name:"doi",label:"DOI"}] },
  { title: "Title & contributors", fields: [{name:"title",label:"Title",wide:true},{name:"subtitle",label:"Subtitle",wide:true},{name:"edition",label:"Edition statement"},{name:"language",label:"Language code",list: languageList()}] },
  { title: "Description", fields: [{name:"description",label:"Description",wide:true,type:"textarea"},{name:"review",label:"Review quote",wide:true,type:"textarea"},{name:"biography",label:"Author biography",wide:true,type:"textarea"},{name:"audience",label:"Audience code",list:28}] },
  { title: "Publishing & availability", fields: [{name:"publisher",label:"Publisher name"},{name:"imprint",label:"Imprint"},{name:"publicationDate",label:"Publication date",placeholder:"20261018"},{name:"publishingStatus",label:"Publishing status",list:64},{name:"countryOfPublication",label:"Country of publication",list:91},{name:"copyrightYear",label:"Copyright year",placeholder:"2026"}] },
  { title: "Physical & digital product", fields: [{name:"productComposition",label:"Product composition",list:2},{name:"productForm",label:"Product form",list:150},{name:"productFormDetail",label:"Product form detail",list:175},{name:"extent",label:"Extent value",placeholder:"320"},{name:"extentUnit",label:"Extent unit",list: codelistNumber("Extent unit")},{name:"dimensions",label:"Dimensions (HxWxD)",placeholder:"234 x 156 x 24 mm"}] },
  { title: "Sales & pricing", fields: [{name:"market",label:"Market territory",placeholder:"WORLD"},{name:"supplier",label:"Supplier name"},{name:"availability",label:"Availability code",list:65},{name:"currency",label:"Currency",list:96},{name:"price",label:"Price",placeholder:"29.99"},{name:"taxRate",label:"Tax rate percent",placeholder:"10"}] },
];

function codelistNumber(heading: string): number | undefined {
  // Codelists are part of the generated package data; look them up by heading.
  for (let n = 1; n <= 263; n++) if (getList(n)?.heading.toLocaleLowerCase() === heading.toLocaleLowerCase()) return n;
  return undefined;
}
function languageList(): number { return 74; }
const listFor = (field: Field) => field.list === undefined ? undefined : getList(field.list);
const esc = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const codedInput = (field: Field) => {
  const list = listFor(field);
  if (!list) return `<input name="${field.name}" placeholder="${esc(field.placeholder ?? "")}" />`;
  const options = list.entries.map((entry) => `<option value="${esc(entry.code)}" label="${esc(entry.heading)}">${esc(entry.code)} — ${esc(entry.heading)}</option>`).join("");
  if (list.entries.length <= 20) return `<select name="${field.name}"><option value="">Choose…</option>${options}</select>`;
  return `<input name="${field.name}" list="codes-${field.list}" placeholder="Search ${esc(list.heading.toLowerCase())}" /><datalist id="codes-${field.list}">${options}</datalist>`;
};
const root = document.querySelector<HTMLDivElement>("#sections")!;
const form = document.querySelector<HTMLFormElement>("#product-form")!;
const output = document.querySelector<HTMLElement>("#output")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
let generatedXml = "";
root.innerHTML = sections.map((section) => `<section><h2>${section.title}</h2><div class="fields">${section.fields.map((field) => `<label class="field ${field.wide ? "wide" : ""}">${field.label}${field.type === "textarea" ? `<textarea name="${field.name}" rows="3"></textarea>` : codedInput(field)}</label>`).join("")}</div>${section.title === "Title & contributors" ? repeatControl("contributors", "Contributor", ["Role", "Person name"], ["role", "name"], [17]) : ""}${section.title === "Identifiers" ? repeatControl("identifiers", "Additional identifier", ["ID type", "ID value"], ["type", "value"], [5]) : ""}${section.title === "Sales & pricing" ? repeatControl("prices", "Additional price", ["Currency", "Amount"], ["currency", "amount"], [codelistNumber("Currency code – based on ISO 4217")]) : ""}${section.title === "Title & contributors" ? repeatControl("subjects", "Subject", ["Scheme code", "Subject code"], ["scheme", "code"], [27]) : ""}${section.title === "Physical & digital product" ? repeatControl("resources", "Supporting resource", ["Resource type", "Resource URL"], ["type", "url"], [158]) : ""}</section>`).join("");
const repeatedLists = [17, 5, 27, 158];
for (const number of repeatedLists) {
  const list = getList(number)!;
  const datalist = document.createElement("datalist"); datalist.id = `codes-${number}`;
  datalist.innerHTML = list.entries.map((entry) => `<option value="${esc(entry.code)}" label="${esc(entry.heading)}"></option>`).join("");
  root.append(datalist);
}
function repeatControl(group: string, label: string, placeholders: string[], names: string[], lists: (number | undefined)[]) {
  return `<div class="repeat"><strong>${label}s</strong><div data-rows="${group}"></div><button type="button" data-add="${group}" data-label="${label}" data-fields="${names.join(",")}" data-placeholders="${placeholders.join("|")}" data-lists="${lists.map((x) => x ?? "").join(",")}">+ Add ${label.toLowerCase()}</button></div>`;
}
function rowControl(listNumber: number | undefined, name: string, placeholder: string) {
  const list = listNumber === undefined ? undefined : getList(listNumber);
  if (!list) return `<input data-field="${name}" aria-label="${placeholder}" placeholder="${placeholder}" />`;
  const options = list.entries.map((entry) => `<option value="${esc(entry.code)}" label="${esc(entry.heading)}">${esc(entry.code)} — ${esc(entry.heading)}</option>`).join("");
  return list.entries.length <= 20
    ? `<select data-field="${name}" aria-label="${placeholder}"><option value="">Choose…</option>${options}</select>`
    : `<input data-field="${name}" aria-label="${placeholder}" list="codes-${listNumber}" placeholder="Search ${esc(list.heading.toLowerCase())}" />`;
}
document.querySelectorAll<HTMLButtonElement>("[data-add]").forEach((button) => button.addEventListener("click", () => {
  const group = button.dataset.add!;
  const names = button.dataset.fields!.split(",");
  const placeholders = button.dataset.placeholders!.split("|");
  const lists = button.dataset.lists!.split(",").map((n) => n ? Number(n) : undefined);
  const row = document.createElement("div"); row.className = "repeat-row";
  row.innerHTML = names.map((name, i) => rowControl(lists[i], name, placeholders[i])).join("") + '<button type="button" aria-label="Remove entry">Remove</button>';
  row.querySelector("button")!.addEventListener("click", () => row.remove());
  document.querySelector(`[data-rows="${group}"]`)!.append(row);
}));
const value = (name: string) => String(new FormData(form).get(name) ?? "").trim();
function prettyPrintXml(xml: string): string {
  let depth = 0;
  return xml
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
      const formatted = `${"  ".repeat(depth)}${trimmed}`;
      if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !/<[^>]+>[^<]+<\//.test(trimmed)) depth++;
      return formatted;
    })
    .join("\n");
}
function rows(group: string) { return [...document.querySelectorAll<HTMLElement>(`[data-rows="${group}"] .repeat-row`)].map((row) => Object.fromEntries([...row.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]")].map((input) => [input.dataset.field!, input.value.trim()]))); }
form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const p = createProduct({recordReference:value("recordReference") || "DEMO-001", notificationType:value("notificationType") || "03", title:value("title") || "Untitled product", productComposition:value("productComposition") || "00", productForm:value("productForm") || "BC"});
    const set = (key: string, val: string) => { if (val) p.set(key, val); };
    set("recordSourceType",value("recordSourceType")); set("recordSourceName",value("recordSourceName"));
    const ids = [{type:"15",value:value("isbn")},{type:"03",value:value("ean")},{type:"01",value:value("proprietaryId")},{type:"06",value:value("doi")},...rows("identifiers")];
    for (const id of ids) if (id.type && id.value) p.identifier(id.type,id.value);
    for (const contributor of rows("contributors")) if (contributor.role && contributor.name) p.contributor(contributor.role,contributor.name);
    for (const subject of rows("subjects")) if (subject.scheme && subject.code) p.subject(subject.scheme,subject.code);
    const detail: Record<string, unknown> = {};
    const descriptive: Record<string,string> = {edition:"editionStatement",language:"language",audience:"audienceCode"};
    for (const [field,key] of Object.entries(descriptive)) if(value(field)) detail[key] = value(field);
    const currentDetail = (p.build().descriptiveDetail ?? {}) as Record<string, unknown>;
    if (value("subtitle")) {
      const titleDetails = [...(currentDetail.titleDetail as Record<string, unknown>[] ?? [])];
      const firstTitle = { ...titleDetails[0] };
      const titleElements = [...(firstTitle.titleElement as Record<string, unknown>[] ?? [])];
      titleElements[0] = { ...titleElements[0], subtitle: value("subtitle") };
      firstTitle.titleElement = titleElements;
      titleDetails[0] = firstTitle;
      detail.titleDetail = titleDetails;
    }
    if(Object.keys(detail).length) p.set("descriptiveDetail", {...currentDetail, ...detail} as OnixNode);
    const publishing: Record<string,string> = {publisher:"publisherName",imprint:"imprintName",publicationDate:"publishingDate",publishingStatus:"publishingStatus",countryOfPublication:"countryOfPublication",copyrightYear:"copyrightYear"};
    const publishingDetail: Record<string,unknown> = {};
    for(const [field,key] of Object.entries(publishing)) if(value(field)) publishingDetail[key]=value(field);
    if(Object.keys(publishingDetail).length) p.set("publishingDetail",publishingDetail as OnixNode);
    if(value("productFormDetail")) p.set("descriptiveDetail",{...(p.build().descriptiveDetail as object ?? {}), productFormDetail:[{productFormDetail:value("productFormDetail")}]});
    if(value("extent")) p.set("descriptiveDetail",{...(p.build().descriptiveDetail as object ?? {}), extent:[{extentType:"00",extentValue:value("extent"),extentUnit:value("extentUnit") || "03"}]});
    if(value("dimensions")) p.set("descriptiveDetail",{...(p.build().descriptiveDetail as object ?? {}), measure:[{measureType:"01",measurement:value("dimensions"),measureUnitCode:"mm"}]});
    const sales: Record<string,unknown> = {};
    for(const [field,key] of [["market","territory"],["supplier","supplierName"],["availability","productAvailability"]]) if(value(field)) sales[key]=value(field);
    const priceRows = [{currency:value("currency"),amount:value("price")},...rows("prices")].filter(x=>x.currency&&x.amount);
    if(priceRows.length) sales.price=priceRows.map(x=>({priceType:"01",currencyCode:x.currency,priceAmount:x.amount,...(value("taxRate")?{tax:{taxRateCode:"Z",taxRatePercent:value("taxRate")}}:{})}));
    if(Object.keys(sales).length) p.set("productSupply",{supplyDetail:[sales as OnixNode]} as OnixNode);
    const resources = rows("resources").filter(resource => resource.type && resource.url);
    if(resources.length) p.set("collateralDetail",{supportingResource:resources.map(resource=>({resourceContentType:resource.type,contentAudience:"00",resourceMode:"02",resourceVersion:[{resourceForm:"01",resourceLink:resource.url}]}))});
    const message = createOnixMessage().header({sender:{senderName:value("publisher") || "ONIX Engine demo"},sentDateTime:new Date().toISOString().slice(0,10).replaceAll("-","")}).product(p).build();
    generatedXml = serializeOnix(message,{tags:(new FormData(form).get("tags") as "reference"|"short") || "reference"});
    output.textContent = prettyPrintXml(generatedXml);
    notice.textContent = "XML generated. The demo does not validate against the XSD.";
  } catch(error) { notice.textContent = error instanceof Error ? error.message : String(error); }
});
document.querySelector<HTMLButtonElement>("#copy")!.addEventListener("click", async () => { if(generatedXml){ await navigator.clipboard.writeText(generatedXml); notice.textContent="Copied to clipboard."; } });
document.querySelector<HTMLButtonElement>("#download")!.addEventListener("click", () => { if(!generatedXml) return; const url=URL.createObjectURL(new Blob([generatedXml],{type:"application/xml"})); const a=document.createElement("a");a.href=url;a.download="onix-product.xml";a.click();URL.revokeObjectURL(url); });
