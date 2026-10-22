import "/components/index.js";
import "/scripts/customRenderer.js";
import { confirmDialog } from "/components/pkts-modal.js";
import {
	createIcon,
	handleFormActions,
	mountForm,
	onPageLoad,
	replaceWithTwin,
	setPageMode,
	syncDisabledState,
	upgradeDeleteButtons,
	validateForm,
	watchForm,
} from "/scripts/utils/json-form-page.js";
import { createFieldsTable } from "/scripts/utils/clickhouse-fields-table.js";

// Schema, layout and starting data come from the API
// (adminui/api/form_schemas/clickhouse_table_schemas.py).
const FORM_URL = () => `${window.ADMINUI_API_BASE}/table/new/form/`;
const CREATE_URL = () => `${window.ADMINUI_API_BASE}/table/`;

const FORM_ID = "table-form";
const FORM_SELECTOR = "#table-json-form";

const PAGE = {
	page: ".table-page",
	title: "#table-title",
	actions: "#table-success-actions",
	editTitle: "Create New Clickhouse Table",
};

let formDefinition = null;

async function loadFormDefinition() {
	if (formDefinition) return formDefinition;

	const response = await fetch(FORM_URL());
	if (!response.ok) throw new Error(`Form request failed: ${response.status}`);

	const { json_schema, ui_schema, form_data } = await response.json();
	formDefinition = { schema: json_schema, uiSchema: ui_schema, initialData: form_data };
	return formDefinition;
}

/* =========================================================
   JSON Form lifecycle
   ========================================================= */

async function initializeTablePage(container) {
	const jsonForm = container.matches?.(FORM_SELECTOR)
		? container
		: container.querySelector(FORM_SELECTOR);

	// Skip a form that is showing saved data, so a swap can't overwrite it
	if (!jsonForm || jsonForm.dataset.mode === "saved" || jsonForm.dataset.initialized) return;
	jsonForm.dataset.initialized = "true";

	try {
		const { schema, uiSchema, initialData } = await loadFormDefinition();
		jsonForm.setAttribute("schema-data", JSON.stringify(schema));
		jsonForm.setAttribute("layout-data", JSON.stringify(uiSchema));
		jsonForm.setAttribute("form-data", JSON.stringify(initialData));
	} catch (error) {
		console.error("Could not load the table form:", error);
		showErrors([`Could not load the form from ${FORM_URL()}. Is the API running?`]);
	}
}

onPageLoad(initializeTablePage);

/* =========================================================
   Short error messages
   JSON Forms shows raw schema errors ("is a required property",
   "must match exactly one schema in oneOf"), which read badly and
   don't fit under the narrow row inputs.
   ========================================================= */

const REQUIRED = "Required";

// Unrecognised messages are shown as they are, rather than guessed at
const ERROR_MESSAGES = [
	// A dropdown can only fail oneOf when nothing is picked, so that's "Required" too
	[
		/is a required property|must NOT have fewer than 1 characters|must match exactly one schema in oneOf/,
		REQUIRED,
	],
	[/must be integer/, "Must be a whole number"],
	[/must be >= (\d+)/, (m) => `Must be at least ${m[1]}`],
	[/must match pattern/, "Start with a letter or _; use only letters, numbers and _"],
	[/must NOT be valid/, "This name is reserved by the API"],
];

function friendlyError(text) {
	for (const [pattern, message] of ERROR_MESSAGES) {
		const match = text.match(pattern);
		if (match) return typeof message === "function" ? message(match) : message;
	}
	return text;
}

function shortenErrors(form) {
	form.querySelectorAll("pkts-input-message .error").forEach((el) => {
		const lines = el.textContent
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		if (!lines.length) return;

		// Several errors come joined by newlines. An empty field also fails its
		// other checks (e.g. the name pattern), so "Required" alone is enough.
		const messages = [...new Set(lines.map(friendlyError))];
		const text = messages.includes(REQUIRED) ? REQUIRED : messages.join(" · ");
		if (el.textContent !== text) el.textContent = text;
	});
}

/* =========================================================
   Fields list: round "+" under the rows, trash icon per row
   ========================================================= */

function enhanceTableForm(form) {
	form.querySelectorAll("fieldset.array-list").forEach((list) => {
		list.classList.add("table-fields-list");

		const nativeBtn = list.querySelector(":scope > legend button.array-list-add");
		if (nativeBtn && !nativeBtn.dataset.replaced) {
			const btn = document.createElement("pkts-button");
			btn.className = "table-fields-add";
			btn.setAttribute("type", "button");
			btn.setAttribute("aria-label", "Add field");
			btn.append(createIcon("plus"));
			replaceWithTwin(nativeBtn, btn);
		}

		// Keep it last, since new rows are inserted before it
		const twin = list.querySelector(".table-fields-add");
		if (twin && twin !== list.lastElementChild) list.append(twin);
	});

	upgradeDeleteButtons(form);
	syncDisabledState(form);
}

// Error text is re-rendered on every form update, so fix it right away
// rather than on the next frame (frames can be paused, e.g. background tabs)
watchForm(FORM_SELECTOR, { sync: shortenErrors, frame: enhanceTableForm });

/* =========================================================
   Errors above the buttons (page rules and API responses)
   ========================================================= */

function showErrors(messages) {
	const box = document.getElementById("table-form-errors");
	if (!box) return;

	box.textContent = messages.join(" · ");
	box.hidden = messages.length === 0;
}

function hasPrimaryKey(data) {
	const ok = (data?.fields ?? []).some((row) => row.primary_key);
	showErrors(ok ? [] : ["Mark at least one field as a Primary Key."]);
	return ok;
}

/* =========================================================
   Edit / saved views
   ========================================================= */

function showEditMode() {
	showErrors([]);
	mountForm(FORM_SELECTOR, formDefinition, formDefinition.initialData, { readonly: false });
	setPageMode(PAGE, "edit");
}

document.addEventListener("click", (event) => {
	if (event.target.closest("#table-create-another")) showEditMode();
});

/* =========================================================
   Save flow
   ========================================================= */

async function confirmAndSave() {
	const { valid, data } = validateForm(document.querySelector(FORM_SELECTOR), hasPrimaryKey);
	if (!valid) return;

	const tableName = data.name || "table_name";

	const confirmed = await confirmDialog({
		question: `Are you sure you want to create table ${tableName}?`,
		highlight: tableName,
		confirmLabel: "Save",
		confirmIcon: "save",
		cancelIcon: "x",
		body: createFieldsTable(data.fields ?? [], { className: "table-confirm-preview" }),
	});

	if (!confirmed) return;

	try {
		const response = await fetch(CREATE_URL(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const { detail } = await response.json().catch(() => ({}));
			showErrors(
				Array.isArray(detail) ? detail : [detail || `Save failed (${response.status})`],
			);
			return;
		}
	} catch (error) {
		console.error("Could not save table:", error);
		showErrors(["Could not reach the API to save this table."]);
		return;
	}

	mountForm(FORM_SELECTOR, formDefinition, data, { readonly: true });
	setPageMode(PAGE, "saved");
	window.scrollTo({ top: 0, behavior: "smooth" });
}

handleFormActions({
	formId: FORM_ID,
	jsonForm: FORM_SELECTOR,
	onSave: confirmAndSave,
	onCancel: showEditMode,
});
