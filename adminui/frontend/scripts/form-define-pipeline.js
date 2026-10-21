import "/components/index.js";
import "/scripts/customRenderer.js";
import { confirmDialog } from "/components/pkts-modal.js";

import pipelineFormDefinition from "/form_schemas/pipeline-form.js";

const { schema, uiSchema, initialData } = pipelineFormDefinition;

const FORM_SELECTOR = "#pipeline-json-form";

/* =========================================================
   JSON Form lifecycle
   ========================================================= */

function initializePipelinePage(container = document) {
	const jsonForm = container.matches?.(FORM_SELECTOR)
		? container
		: container.querySelector(FORM_SELECTOR);

	// Skip a form that is showing saved data, so a swap can't overwrite it
	if (!jsonForm || jsonForm.dataset.mode === "saved") return;

	jsonForm.setAttribute("schema-data", JSON.stringify(schema));
	jsonForm.setAttribute("layout-data", JSON.stringify(uiSchema));
	jsonForm.setAttribute("form-data", JSON.stringify(initialData));
}

initializePipelinePage(document);

document.body.addEventListener("htmx:afterSwap", (event) => {
	initializePipelinePage(event.detail?.target ?? event.target);
});

/* =========================================================
   Array list config
   ========================================================= */

const TRANSFORMER_COLUMNS_LIST = {
	addButton: "transformer-columns-add",
	fieldset: "transformer-columns-list",
	wrapper: "transformer-columns-wrapper",
	item: "transformer-columns-item",
};

const ARRAY_LIST_CONFIG = {
	"mapping rules": TRANSFORMER_COLUMNS_LIST,
	"transformer columns": TRANSFORMER_COLUMNS_LIST, // keep if you might switch back
	fields: {
		addButton: "config-fields-add",
		fieldset: "config-fields-list",
		wrapper: "config-fields-wrapper",
		item: "config-fields-item",
	},
	map: {
		addButton: "config-map-add",
		fieldset: "config-map-list",
		wrapper: "config-map-wrapper",
		item: "config-map-item",
	},
};

function getListConfig(legend) {
	const label = legend
		.querySelector(".array-list-label")
		?.textContent.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
	return ARRAY_LIST_CONFIG[label] ?? null;
}

/* =========================================================
   Helpers
   ========================================================= */

function createIcon(name, size = "16") {
	const icon = document.createElement("pkts-icon");
	icon.setAttribute("name", name);
	icon.setAttribute("size", size);
	return icon;
}

function setRole(el, role) {
	if (el && el.dataset.role !== role) el.dataset.role = role;
}

function replaceWithTwin(nativeBtn, twin) {
	twin.dataset.twin = "true";
	twin.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (twin.hasAttribute("disabled")) return;
		nativeBtn.click();
	});
	nativeBtn.dataset.replaced = "true";
	nativeBtn.setAttribute("aria-hidden", "true");
	nativeBtn.tabIndex = -1;
	nativeBtn.after(twin);
	twin.toggleAttribute("disabled", nativeBtn.disabled);
}

// Finds a pkts-form-control by schema property name.
// id is the UI-schema scope; name is the data path (columns.0.match_value, or
// just match_field at the root). The name match is anchored to a dot so that
// "match_value" doesn't also match "vendor_match_value", and "match_field"
// doesn't also match "vendor_match_field" or "match_field_mirror".
const sel = (prop) =>
	`pkts-form-control[id$="/properties/${prop}"], pkts-form-control[name$=".${prop}"], pkts-form-control[name="${prop}"]`;

/* =========================================================
   Enhancements (each is idempotent)
   ========================================================= */

function tagArrayLists(form) {
	form.querySelectorAll("legend.array-list-legend").forEach((legend) => {
		const config = getListConfig(legend);
		const fieldset = legend.closest("fieldset.array-list");
		if (!config || !fieldset) return;

		fieldset.classList.add(config.fieldset);

		fieldset.querySelectorAll(":scope > .array-list-item-wrapper").forEach((wrapper) => {
			wrapper.classList.add(config.wrapper);
			wrapper
				.querySelectorAll(":scope > .array-list-item")
				.forEach((item) => item.classList.add(config.item));
		});
	});
}

function upgradeAddButtons(form) {
	form.querySelectorAll("legend.array-list-legend").forEach((legend) => {
		const config = getListConfig(legend);
		if (!config) return;

		const nativeBtn = legend.querySelector("button.array-list-add");
		if (!nativeBtn || nativeBtn.dataset.replaced) return;

		const btn = document.createElement("pkts-button");
		btn.className = config.addButton;
		btn.setAttribute("type", "button");
		btn.append(createIcon("plus"), document.createTextNode("Add"));

		replaceWithTwin(nativeBtn, btn);
	});
}

function upgradeDeleteButtons(form) {
	form.querySelectorAll("button.array-list-item-delete").forEach((nativeBtn) => {
		if (nativeBtn.dataset.replaced) return;

		const btn = document.createElement("pkts-icon-button");
		btn.className = "array-list-item-delete-pkts";
		btn.setAttribute("type", "button");
		btn.setAttribute("variant", "tertiary");
		btn.setAttribute("aria-label", "Delete");
		btn.append(createIcon("trash-2"));

		replaceWithTwin(nativeBtn, btn);
	});
}

function syncDisabledState(form) {
	form.querySelectorAll('button[data-replaced="true"]').forEach((nativeBtn) => {
		const twin = nativeBtn.nextElementSibling;
		if (!twin?.dataset.twin) return;
		if (twin.hasAttribute("disabled") !== nativeBtn.disabled) {
			twin.toggleAttribute("disabled", nativeBtn.disabled);
		}
	});
}

/* =========================================================
   Rule rows
   Marks each row (data-row) and each item in it (data-role) so the
   CSS doesn't depend on guessed class names.

   rows : write | if | and | then | default | else
   roles: keyword | operator | chip | toggle | then-left | then-right
          config-caption | config-body   (inside then-right)
   ========================================================= */

const ROW_KEYS = [
	["write", "target_column"],
	["if", "match_value"],
	["and", "vendor_match_field"],
	["then", "operation"],
	["default", "has_default_value"], // the Default Value switch, on its own line
	["else", "default_value"],
];

const TOGGLE_SELECTOR = `${sel("has_vendor_condition")}, ${sel("has_default_value")}`;

function tagConfigColumn(row) {
	const right = row.querySelector(':scope > [data-role="then-right"]');
	if (!right) return;

	const items = right.querySelectorAll(":scope > .vertical-layout > .vertical-layout-item");
	if (items.length < 2) return;

	setRole(items[0], "config-caption");
	setRole(items[1], "config-body");
}

function tagRuleRows(form) {
	form.querySelectorAll(".transformer-columns-item").forEach((item) => {
		item.querySelectorAll(".horizontal-layout").forEach((row) => {
			if (!row.dataset.row) {
				const hit = ROW_KEYS.find(([, prop]) => row.querySelector(sel(prop)));
				if (!hit) return;
				row.dataset.row = hit[0];
			}

			[...row.children]
				.filter((el) => el.classList.contains("horizontal-layout-item"))
				.forEach((el, index) => {
					const controls = el.querySelectorAll("pkts-form-control");
					let role = "";

					if (row.dataset.row === "then" && index === 1) {
						role = "then-left";
					} else if (row.dataset.row === "then" && index === 2) {
						role = "then-right";
					} else if (!controls.length && el.querySelector(":scope > .label-element")) {
						role = index === 0 ? "keyword" : "operator";
					} else if (el.querySelector(sel("match_field_mirror"))) {
						role = "chip";
					} else if (controls.length === 1 && controls[0].matches(TOGGLE_SELECTOR)) {
						role = "toggle";
					}

					setRole(el, role);
				});

			if (row.dataset.row === "then") tagConfigColumn(row);
		});
	});
}

/* =========================================================
   Match Field chip
   Shows the root Match Field value in every rule's IF row
   ========================================================= */

function syncMatchFieldChips(form) {
	const rootValue = String(form.querySelector(sel("match_field"))?.value ?? "").trim();
	const text = rootValue || "Null";

	form.querySelectorAll(sel("match_field_mirror")).forEach((control) => {
		// Readonly controls render plain text instead of a chip
		const target = control.querySelector("pkts-chip button") ?? null;
		if (!target) return;

		if (target.textContent !== text) target.textContent = text;
	});
}

function enhancePipelineForms() {
	document.querySelectorAll(FORM_SELECTOR).forEach((form) => {
		tagArrayLists(form);
		upgradeAddButtons(form);
		upgradeDeleteButtons(form);
		syncDisabledState(form);
		tagRuleRows(form);
		syncMatchFieldChips(form);
	});
}

/* =========================================================
   Re-apply after every JSON Forms render
   ========================================================= */

let enhancementScheduled = false;

new MutationObserver(() => {
	if (enhancementScheduled) return;
	enhancementScheduled = true;
	requestAnimationFrame(() => {
		enhancementScheduled = false;
		enhancePipelineForms();
	});
}).observe(document.body, {
	childList: true,
	subtree: true,
	attributes: true,
	attributeFilter: ["disabled"],
});

document.addEventListener("change", () => {
	document.querySelectorAll(FORM_SELECTOR).forEach((form) => {
		syncMatchFieldChips(form);
	});
});

enhancePipelineForms();

/* =========================================================
   Form data
   ========================================================= */

// UI-only keys that shouldn't be part of the saved data
function stripUiOnlyKeys(data) {
	if (!Array.isArray(data?.columns)) return data;

	return {
		...data,
		columns: data.columns.map(({ match_field_mirror, ...column }) => column),
	};
}

function getFormData() {
	const elem = document.querySelector(FORM_SELECTOR);
	if (!elem?.serializeForm) return null;

	try {
		return stripUiOnlyKeys(JSON.parse(elem.serializeForm()));
	} catch (error) {
		console.error("Could not read form data:", error);
		return null;
	}
}

/* =========================================================
   Save dialog preview
   ========================================================= */

function buildPreviewText(data) {
	if (!data) return "No data available.";
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

// Builds a fresh preview block each time, so Copy always uses the current text
function createPreview(text) {
	const preview = document.createElement("div");
	preview.className = "pipeline-save-preview";
	preview.innerHTML = `
		<p class="pipeline-save-preview__label">Preview</p>
		<div class="pipeline-save-preview__code-wrap">
			<pkts-chip rounded="" class="pipeline-save-preview__badge">SQL</pkts-chip>
			<button type="button" class="pipeline-save-preview__copy" aria-label="Copy preview">
				<pkts-icon name="copy" size="16"></pkts-icon>
			</button>
			<pre class="pipeline-save-preview__code"></pre>
		</div>
	`;

	preview.querySelector(".pipeline-save-preview__code").textContent = text;
	preview
		.querySelector(".pipeline-save-preview__copy")
		.addEventListener("click", () => navigator.clipboard?.writeText(text));

	return preview;
}

/* =========================================================
   Success view (same page, same schema, read-only)
   ========================================================= */

// The saved payload has no UI-only keys, so rebuild them for display
function toFormData(data) {
	return {
		...data,
		columns: (data.columns ?? []).map((column) => ({
			...column,
			match_field_mirror: data.match_field,
			has_vendor_condition: Boolean(column.vendor_match_field || column.vendor_match_value),
			has_default_value: column.default_value != null && column.default_value !== "",
		})),
	};
}

// Swap in a fresh <json-form>. All attributes are set before it is inserted.
function mountForm(formData, { readonly }) {
	const current = document.querySelector(FORM_SELECTOR);
	if (!current) return;

	const next = document.createElement("json-form");
	next.id = current.id;
	next.className = current.className;
	next.setAttribute("schema-data", JSON.stringify(schema));
	next.setAttribute("layout-data", JSON.stringify(uiSchema));
	next.setAttribute("form-data", JSON.stringify(formData));

	if (readonly) {
		next.setAttribute("readonly", "true");
		next.setAttribute("data-readonly", ""); // so the readonly CSS applies immediately
		next.dataset.mode = "saved";
	}

	current.replaceWith(next);
}

function setPageMode(mode) {
	const page = document.querySelector(".pipeline-page");
	const title = document.getElementById("pipeline-title");
	const actions = document.getElementById("pipeline-success-actions");
	if (!page) return;

	if (mode === "saved") {
		page.dataset.mode = "saved";
		if (title) title.textContent = "Success!";
		if (actions) actions.hidden = false;
	} else {
		delete page.dataset.mode;
		if (title) title.textContent = "Define Pipeline";
		if (actions) actions.hidden = true;
	}
}

function showSuccess(data) {
	mountForm(toFormData(data), { readonly: true });
	setPageMode("saved");
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function showEditMode() {
	mountForm(initialData, { readonly: false });
	setPageMode("edit");
}

document.addEventListener("click", (event) => {
	if (event.target.closest("#pipeline-create-another")) showEditMode();
});

/* =========================================================
   Validation
   ========================================================= */

// Hidden rows may stay in the DOM, so only check controls the user can see
const isVisible = (el) => el.getClientRects().length > 0;

function getVisibleControls(form) {
	return [...form.querySelectorAll("pkts-form-control")].filter(isVisible);
}

function focusFirstInvalid(form) {
	// markDirty() has already updated data-invalid, so wait one frame for layout
	requestAnimationFrame(() => {
		const first = form.querySelector("pkts-form-control[data-invalid]");
		if (!first) return;

		first.scrollIntoView({ behavior: "smooth", block: "center" });
		first.focus();
	});
}

// Returns { valid, data }. Shows errors on every visible field when invalid.
// The "markAllDirty" handler in customRenderer.js shows the error banner.
function validatePipelineForm() {
	const form = document.querySelector(FORM_SELECTOR);
	if (!form?.validate || !form?.serializeForm) return { valid: false, data: null };

	// 1. Schema validation (required, minLength, minItems, allOf conditions)
	const schemaValid = form.validate();

	// 2. Reveal errors. Query after validate() in case it re-rendered controls.
	const controls = getVisibleControls(form);
	controls.forEach((control) => control.markDirty());

	// 3. Per-field validity (required + errors reported by JSON Forms)
	const controlsValid = controls.every((control) => control.checkValidity());

	// 4. Nothing entered at all
	const data = getFormData();
	const isEmpty = !data || Object.keys(data).length === 0;

	const valid = schemaValid && controlsValid && !isEmpty;

	if (!valid) {
		document.dispatchEvent(new CustomEvent("markAllDirty"));
		focusFirstInvalid(form);
	}

	return { valid, data };
}

/* =========================================================
   Save flow
   ========================================================= */

let saveInFlight = false;

async function confirmAndSave() {
	// Ignore stray save events while showing the success view
	if (document.querySelector(FORM_SELECTOR)?.dataset.mode === "saved") return;
	if (saveInFlight) return;

	saveInFlight = true;

	try {
		// 1. Validate. The dialog only opens if this passes.
		const { valid, data } = validatePipelineForm();
		if (!valid) return;

		document.dispatchEvent(new Event("validated"));

		// 2. Confirm (resolves true/false, so no listeners pile up between attempts)
		const pipelineName = data.name || "pipeline_name";

		const confirmed = await confirmDialog({
			question: `Are you sure you want to create pipeline ${pipelineName}?`,
			highlight: pipelineName,
			confirmLabel: "Save",
			confirmIcon: "save",
			body: createPreview(buildPreviewText(data)),
		});

		if (!confirmed) return;

		// 3. API call goes here once the payload conversion is settled.
		// Show the success view only after it succeeds.
		showSuccess(data);
	} finally {
		saveInFlight = false;
	}
}

document.body.addEventListener("form-save", confirmAndSave);

// Stop the browser from submitting or navigating on its own (Enter key, requestSubmit)
document.addEventListener("submit", (event) => {
	if (event.target.id === "pipeline-form") event.preventDefault();
});
