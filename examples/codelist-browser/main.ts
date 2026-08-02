import { getCodelist, getCodelists, metadata } from "../../src/index.ts";
import "./style.css";

const codelistSelect = document.querySelector<HTMLSelectElement>("#codelist-select");
const entrySearch = document.querySelector<HTMLInputElement>("#entry-search");
const listHeading = document.querySelector<HTMLElement>("#list-heading");
const entryCount = document.querySelector<HTMLElement>("#entry-count");
const issue = document.querySelector<HTMLElement>("#issue");
const entryResults = document.querySelector<HTMLTableSectionElement>("#entry-results");
const emptyState = document.querySelector<HTMLElement>("#empty-state");

if (
  !codelistSelect ||
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
  const codelistNumber = Number(codelistSelect.value);
  const codelist = getCodelist(codelistNumber);

  if (!codelist) {
    listHeading.textContent = "Codelist not found";
    entryCount.textContent = "";
    entryResults.replaceChildren();
    emptyState.hidden = false;
    return;
  }

  const query = entrySearch.value.trim().toLowerCase();
  const entries = codelist.entries.filter(
    ({ code, heading }) =>
      code.toLowerCase().includes(query) || heading.toLowerCase().includes(query),
  );

  listHeading.textContent = `${codelist.number} — ${codelist.heading}`;
  entryCount.textContent = `${entries.length} of ${codelist.entries.length} entries`;
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
entrySearch.addEventListener("input", renderEntries);
renderEntries();
