// Lists (array fields) in the Metadata Manager record editor, laid out like
// the lists on Define Pipeline: "+ Add" on the right of the list label and a
// trash icon next to each item. JSON Forms' own buttons stay in the DOM and
// still do the adding and deleting; the Packets twins only click them.
import {
	syncDisabledState,
	upgradeAddButtons,
	upgradeDeleteButtons,
	watchForm,
} from "/scripts/utils/json-form-page.js";

const FORM_SELECTOR = "#records-json-form";

function enhanceRecordLists(form) {
	upgradeAddButtons(form, "records-list-add");
	upgradeDeleteButtons(form);
	syncDisabledState(form);
}

// Loaded once from index.html, so this observer is set up once, not on every
// visit to the page
watchForm(FORM_SELECTOR, { frame: enhanceRecordLists });
