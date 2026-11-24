import { createOnixMessage, createProduct } from "../src/builders.js";
import { serializeOnix } from "../src/xml.js";
import type { OnixNode } from "../src/types/onix.js";
import {
  fillEditorFromSample,
  mountSchemaEditor,
  readProductEditor,
} from "./product-editor.js";
const root = document.querySelector<HTMLDivElement>("#sections")!;
const form = document.querySelector<HTMLFormElement>("#product-form")!;
const output = document.querySelector<HTMLElement>("#output")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
let generatedXml = "";
root.innerHTML = "";
const headerEditor = document.createElement("section");
headerEditor.innerHTML = "<h2>ONIX message header</h2>";
root.append(headerEditor);
mountSchemaEditor(headerEditor, "Header");
const schemaEditor = document.createElement("section");
schemaEditor.innerHTML = "<h2>Product</h2><p>Fields follow the pinned ONIX 3.1.3 schema. Repeated fields have add and remove controls.</p>";
root.append(schemaEditor);
mountSchemaEditor(schemaEditor, "Product");
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
form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const p = createProduct();
    const completeProduct = readProductEditor(schemaEditor);
    for (const [key, val] of Object.entries(completeProduct)) p.set(key, val as OnixNode);
    const header = readProductEditor(headerEditor);
    const message = createOnixMessage().header(header as OnixNode).product(p).build();
    generatedXml = serializeOnix(message,{tags:(new FormData(form).get("tags") as "reference"|"short") || "reference"});
    output.textContent = prettyPrintXml(generatedXml);
    notice.textContent = "XML generated. The demo does not validate against the XSD.";
  } catch(error) { notice.textContent = error instanceof Error ? error.message : String(error); }
});
document.querySelector<HTMLButtonElement>("#copy")!.addEventListener("click", async () => { if(generatedXml){ await navigator.clipboard.writeText(generatedXml); notice.textContent="Copied to clipboard."; } });
document.querySelector<HTMLButtonElement>("#download")!.addEventListener("click", () => { if(!generatedXml) return; const url=URL.createObjectURL(new Blob([generatedXml],{type:"application/xml"})); const a=document.createElement("a");a.href=url;a.download="onix-product.xml";a.click();URL.revokeObjectURL(url); });
document.querySelector<HTMLButtonElement>("#fill-sample")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#fill-sample")!;
  button.disabled = true;
  try {
    const response = await fetch("/sample.xml");
    if (!response.ok) throw new Error("The sample ONIX file could not be loaded.");
    const sample = new DOMParser().parseFromString(await response.text(), "application/xml");
    fillEditorFromSample(headerEditor, schemaEditor, sample);
    notice.textContent = "Official ONIX sample loaded into the form.";
  } catch (error) {
    notice.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
});
