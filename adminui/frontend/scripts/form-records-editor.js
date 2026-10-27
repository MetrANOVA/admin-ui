// Lists (array fields) in the Metadata Manager record editor, laid out like
// the lists on Define Pipeline: "+ Add" on the right of the list label and a
// trash icon next to each item. JSON Forms' own buttons stay in the DOM and
// still do the adding and deleting; the Packets twins only click them.
import {
	createIcon,
	replaceWithTwin,
	syncDisabledState,
	upgradeDeleteButtons,
	watchForm,
} from "/scripts/utils/json-form-page.js";

const FORM_SELECTOR = "#records-json-form";

function upgradeAddButtons(form) {
	form.querySelectorAll("legend.array-list-legend button.array-list-add").forEach((nativeBtn) => {
		if (nativeBtn.dataset.replaced) return;

		const btn = document.createElement("pkts-button");
		btn.className = "records-list-add";
		btn.setAttribute("type", "button");
		btn.append(createIcon("plus"), document.createTextNode("Add"));

		replaceWithTwin(nativeBtn, btn);
	});
}

function enhanceRecordLists(form) {
	upgradeAddButtons(form);
	upgradeDeleteButtons(form);
	syncDisabledState(form);
}

// Loaded once from index.html, so this observer is set up once, not on every
// visit to the page
watchForm(FORM_SELECTOR, { frame: enhanceRecordLists });
