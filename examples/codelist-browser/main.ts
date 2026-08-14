import {
  getCodelist,
  getCodelists,
  getThemaEntries,
  metadata,
  themaMetadata,
} from "../../src/index.ts";
import "./style.css";

const codelistSelect =
  document.querySelector<HTMLSelectElement>("#codelist-select");
const datasetSelect =
  document.querySelector<HTMLSelectElement>("#dataset-select");
const codelistControl =
  document.querySelector<HTMLElement>("#codelist-control");
const entrySearch = document.querySelector<HTMLInputElement>("#entry-search");
const listHeading = document.querySelector<HTMLElement>("#list-heading");
const entryCount = document.querySelector<HTMLElement>("#entry-count");
const issue = document.querySelector<HTMLElement>("#issue");
const entryResults =
  document.querySelector<HTMLTableSectionElement>("#entry-results");
const emptyState = document.querySelector<HTMLElement>("#empty-state");

if (
  !codelistSelect ||
  !datasetSelect ||
  !codelistControl ||
  !entrySearch ||
  !listHeading ||
  !entryCount ||
  !issue ||
  !entryResults ||
  !emptyState
) {
  throw new Error("The codelist browser could not find its required elements.");
}

const codelists = getCodelists();

for (const codelist of codelists) {
  const option = new Option(
    `${codelist.number} — ${codelist.heading}`,
    String(codelist.number),
  );
  codelistSelect.add(option);
}

codelistSelect.value = "27";
issue.textContent = `Codelists issue ${metadata.issue}`;

function renderEntries() {
  const isThema = datasetSelect.value === "thema";
  codelistControl.hidden = isThema;
  const codelistNumber = Number(codelistSelect.value);
  const codelist = isThema ? undefined : getCodelist(codelistNumber);

  if (!isThema && !codelist) {
    listHeading.textContent = "Codelist not found";
    entryCount.textContent = "";
    entryResults.replaceChildren();
    emptyState.hidden = false;
    return;
  }

  const query = entrySearch.value.trim().toLowerCase();
  const allEntries = isThema ? getThemaEntries() : codelist.entries;
  const entries = allEntries.filter(
    ({ code, heading }) =>
      code.toLowerCase().includes(query) ||
      heading.toLowerCase().includes(query),
  );

  listHeading.textContent = isThema
    ? "Thema subject codes"
    : `${codelist.number} — ${codelist.heading}`;
  entryCount.textContent = `${entries.length} of ${allEntries.length} entries`;
  issue.textContent = isThema
    ? `Thema ${themaMetadata.version} · updated ${themaMetadata.lastUpdated}`
    : `Codelists issue ${metadata.issue}`;
  emptyState.hidden = entries.length > 0;
  entryResults.replaceChildren(
    ...entries.map(({ code, heading }) => {
      const row = document.createElement("tr");
      const codeCell = document.createElement("td");
      const headingCell = document.createElement("td");

      codeCell.textContent = code;
      headingCell.textContent = heading;
      row.append(codeCell, headingCell);
      return row;
    }),
  );
}

codelistSelect.addEventListener("change", renderEntries);
datasetSelect.addEventListener("change", renderEntries);
entrySearch.addEventListener("input", renderEntries);
renderEntries();
