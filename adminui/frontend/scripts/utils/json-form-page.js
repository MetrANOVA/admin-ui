// Shared plumbing for pages built around a <json-form>: Packets buttons in
// place of JSON Forms' native ones, validation, the read-only success view
// and the save flow. Page scripts keep only what is specific to their form.

/* =========================================================
   Page setup
   ========================================================= */

// Runs init now and again whenever htmx swaps new content in, since page
// scripts are loaded once in index.html but pages come and go.
export function onPageLoad(init) {
	init(document);
	document.body.addEventListener("htmx:afterSwap", (event) => {
		init(event.detail?.target ?? event.target);
	});
}

// Calls sync(form) on every change to the form and frame(form) once per
// animation frame after changes. JSON Forms re-renders often, so anything
// added on top of it has to be re-applied.
export function watchForm(selector, { sync, frame } = {}) {
	let scheduled = false;

	new MutationObserver(() => {
		const form = document.querySelector(selector);
		if (!form) return;

		openRequiredLists(form);
		updateListMessages(form);
		sync?.(form);

		if (!frame || scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			const current = document.querySelector(selector);
			if (current) frame(current);
		});
	}).observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["disabled"],
	});
}

/* =========================================================
   Packets buttons in place of JSON Forms' native ones
   ========================================================= */

export function createIcon(name, size = "16") {
	const icon = document.createElement("pkts-icon");
	icon.setAttribute("name", name);
	icon.setAttribute("size", size);
	return icon;
}

// Hides nativeBtn and puts twin after it; clicking twin clicks nativeBtn,
// so JSON Forms still does the adding and deleting.
export function replaceWithTwin(nativeBtn, twin) {
	twin.dataset.twin = "true";
	twin.addEventListener("click", (event) => {
		// Only the visible button counts, not empty space in the host element
		if (!event.target.closest("button")) return;
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

export function upgradeDeleteButtons(form) {
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

// JSON Forms disables its own buttons (e.g. delete on the last row); mirror that
export function syncDisabledState(form) {
	form.querySelectorAll('button[data-replaced="true"]').forEach((nativeBtn) => {
		const twin = nativeBtn.nextElementSibling;
		if (!twin?.dataset.twin) return;
		if (twin.hasAttribute("disabled") !== nativeBtn.disabled) {
			twin.toggleAttribute("disabled", nativeBtn.disabled);
		}
	});
}

/* =========================================================
   Form data and validation
   ========================================================= */

export function readForm(form) {
	if (!form?.serializeForm) return null;

	try {
		return JSON.parse(form.serializeForm());
	} catch (error) {
		console.error("Could not read form data:", error);
		return null;
	}
}

// Hidden rows may stay in the DOM, so only check controls the user can see
const isVisible = (el) => el.getClientRects().length > 0;

// Returns { valid, data }. Shows errors on every visible field and list when
// invalid and scrolls to the first one. check(data) adds page-specific rules
// that the schema can't express; a check that fails should show its own message.
export function validateForm(form, check = () => true) {
	if (!form?.validate || !form?.serializeForm) return { valid: false, data: null };

	// 1. Schema validation (required, minLength, minItems, if/then, ...)
	const schemaValid = form.validate();

	// 2. Reveal errors. Query after validate() in case it re-rendered controls.
	const controls = [...form.querySelectorAll("pkts-form-control")].filter(isVisible);
	controls.forEach((control) => control.markDirty());

	// 3. Per-field validity (required + errors reported by JSON Forms)
	const controlsValid = controls.every((control) => control.checkValidity());

	// 4. Lists (arrays) have no pkts-form-control, so show their errors here
	form.dataset.validated = "true";
	const listErrors = updateListMessages(form);

	// 5. Page rules
	const data = readForm(form);
	const checkValid = check(data);

	const valid = schemaValid && controlsValid && checkValid;

	// A schema error can belong to something with nowhere to show it. Say so
	// rather than letting Save silently do nothing.
	const unexplained = !schemaValid && controlsValid && listErrors === 0;
	showFallbackError(form, unexplained);
	if (unexplained) console.warn("Form errors with no visible field:", form.errors?.());

	if (!valid) {
		document.dispatchEvent(new CustomEvent("markAllDirty"));

		// markDirty() has already updated data-invalid, so wait one frame for layout
		requestAnimationFrame(() => {
			const first = form.querySelector(
				"pkts-form-control[data-invalid], fieldset.array-list[data-invalid]",
			);
			first?.scrollIntoView({ behavior: "smooth", block: "center" });
			first?.focus?.();
		});
	}

	return { valid, data };
}

function showFallbackError(form, show) {
	const host = form.closest("form");
	if (!host) return;

	let box = host.querySelector(":scope > .form-fallback-error");
	if (!show) {
		box?.remove();
		return;
	}
	if (!box) {
		box = document.createElement("p");
		box.className = "form-fallback-error";
		box.setAttribute("role", "alert");
		box.textContent = "Some required information is missing. Check each section and try again.";
		const actions = host.querySelector(":scope > pkts-form-actions");
		actions ? actions.before(box) : host.append(box);
	}
}

/* =========================================================
   Required lists
   JSON Forms draws arrays as a list (legend + Add button) with no
   "Required" hint and no error text, so an empty required list
   gives no feedback. Add a message under each list that needs items:
   "Required" while it is empty, and the error after a Save attempt.
   ========================================================= */

const listSchemaCache = new WeakMap();

// Every array in the schema with its path pattern ("/columns/*/config/fields"),
// title and minItems, read from the form's own schema-data.
function schemaLists(form) {
	const raw = form.getAttribute("schema-data");
	const cached = listSchemaCache.get(form);
	if (cached?.raw === raw) return cached.lists;

	const lists = [];
	const walk = (node, path) => {
		if (!node || typeof node !== "object") return;
		if (node.type === "array") {
			lists.push({
				pattern: path,
				depth: (path.match(/\*/g) ?? []).length,
				title: String(node.title ?? path.split("/").pop()).toLowerCase(),
				minItems: node.minItems ?? 0,
			});
		}
		Object.entries(node.properties ?? {}).forEach(([key, child]) =>
			walk(child, `${path}/${key}`),
		);
		if (node.items && !Array.isArray(node.items)) walk(node.items, `${path}/*`);
	};

	try {
		walk(JSON.parse(raw), "");
	} catch {
		// No or invalid schema yet; try again on the next render
	}
	listSchemaCache.set(form, { raw, lists });
	return lists;
}

// Matches a rendered list to its schema array by its label and how deeply it
// is nested in other lists, then fills in the row numbers: /columns/1/config/fields
function listInfo(fieldset, form, lists) {
	const label = fieldset
		.querySelector(":scope > legend .array-list-label")
		?.textContent.trim()
		.toLowerCase();
	if (!label) return null;

	const indices = [];
	let wrapper = fieldset.parentElement?.closest(".array-list-item-wrapper");
	while (wrapper && form.contains(wrapper)) {
		const rows = [
			...wrapper.parentElement.querySelectorAll(":scope > .array-list-item-wrapper"),
		];
		indices.unshift(rows.indexOf(wrapper));
		wrapper = wrapper.parentElement.closest(".array-list-item-wrapper");
	}

	const match = lists.find((list) => list.title === label && list.depth === indices.length);
	if (!match) return null;

	let i = 0;
	return { path: match.pattern.replace(/\*/g, () => indices[i++]), minItems: match.minItems };
}

// Paths of lists that fail validation, with the message to show
function failingLists(form) {
	const failing = new Map();
	for (const error of form.errors?.() ?? []) {
		if (error.keyword === "minItems") {
			const n = error.params?.limit ?? 1;
			failing.set(error.instancePath, n === 1 ? "Add at least one" : `Add at least ${n}`);
		} else if (error.keyword === "required" && error.params?.missingProperty) {
			failing.set(
				`${error.instancePath}/${error.params.missingProperty}`,
				"Add at least one",
			);
		}
	}
	return failing;
}

// Lists that have already been given their first entry. If the user then
// deletes it, leave the list empty (it shows "Required") rather than fight them.
const openedLists = new WeakSet();

// Starts each required list with one blank entry as soon as it appears
// (e.g. picking "Concatenate fields" shows an empty Field input), so users
// see what's needed without having to find the Add button.
export function openRequiredLists(form) {
	if (form.hasAttribute("readonly") || form.dataset.mode === "saved") return;

	const lists = schemaLists(form);
	if (!lists.length) return;

	form.querySelectorAll("fieldset.array-list").forEach((fieldset) => {
		if (openedLists.has(fieldset) || !isVisible(fieldset)) return;
		if (fieldset.querySelector(":scope > .array-list-item-wrapper")) return;

		const info = listInfo(fieldset, form, lists);
		const addButton = fieldset.querySelector(":scope > legend button.array-list-add");
		if (!info || info.minItems < 1 || !addButton || addButton.disabled) return;

		openedLists.add(fieldset);
		addButton.click();
	});
}

// Adds, updates or removes the message under each list. Only touches the DOM
// when something changed, since watchForm calls it on every mutation.
// Returns how many lists are showing an error.
export function updateListMessages(form) {
	const lists = schemaLists(form);
	if (!lists.length) return 0;

	const failing = form.dataset.validated ? failingLists(form) : new Map();
	let errorCount = 0;

	form.querySelectorAll("fieldset.array-list").forEach((fieldset) => {
		const info = listInfo(fieldset, form, lists);
		const next = fieldset.nextElementSibling;
		let message = next?.classList.contains("array-list-message") ? next : null;

		let text = "";
		let isError = false;
		if (info && isVisible(fieldset)) {
			if (failing.has(info.path)) {
				text = failing.get(info.path);
				isError = true;
				errorCount++;
			} else if (
				info.minItems > 0 &&
				!fieldset.querySelector(":scope > .array-list-item-wrapper")
			) {
				text = "Required";
			}
		}

		if (fieldset.hasAttribute("data-invalid") !== isError) {
			fieldset.toggleAttribute("data-invalid", isError);
		}

		if (!text) {
			message?.remove();
			return;
		}
		if (!message) {
			message = document.createElement("p");
			message.className = "array-list-message";
			fieldset.after(message);
		}
		if (message.textContent !== text) message.textContent = text;
		if (message.classList.contains("error") !== isError)
			message.classList.toggle("error", isError);
	});

	return errorCount;
}

/* =========================================================
   Edit / saved views (same page, same schema)
   ========================================================= */

// Swaps the <json-form> matching selector for a freshly rendered one,
// read-only for the success view.
export function mountForm(selector, { schema, uiSchema }, formData, { readonly }) {
	const current = document.querySelector(selector);
	if (!current) return;

	const next = document.createElement("json-form");
	next.id = current.id;
	next.className = current.className;
	next.dataset.initialized = "true";
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

// Switches the page between "edit" and "saved": data-mode on the page (the
// CSS hides edit-only controls), the title text and the success buttons.
export function setPageMode({ page, title, actions, editTitle }, mode) {
	const pageEl = document.querySelector(page);
	const titleEl = document.querySelector(title);
	const actionsEl = document.querySelector(actions);
	if (!pageEl) return;

	const saved = mode === "saved";
	if (saved) pageEl.dataset.mode = "saved";
	else delete pageEl.dataset.mode;
	if (titleEl) titleEl.textContent = saved ? "Success!" : editTitle;
	if (actionsEl) actionsEl.hidden = !saved;
}

/* =========================================================
   Save / cancel
   ========================================================= */

// form-save and form-cancel (from <pkts-form-actions>) bubble up from every
// page, so only react to the form with id formId. onSave won't run twice at
// once or while the success view is showing. Also stops the browser from
// submitting the form itself (Enter key, requestSubmit).
export function handleFormActions({ formId, jsonForm, onSave, onCancel }) {
	let saveInFlight = false;

	document.body.addEventListener("form-save", async (event) => {
		if (event.detail?.form?.id !== formId) return;
		if (document.querySelector(jsonForm)?.dataset.mode === "saved") return;
		if (saveInFlight) return;

		saveInFlight = true;
		try {
			await onSave();
		} finally {
			saveInFlight = false;
		}
	});

	if (onCancel) {
		document.body.addEventListener("form-cancel", (event) => {
			if (event.detail?.form?.id === formId) onCancel();
		});
	}

	document.addEventListener("submit", (event) => {
		if (event.target.id === formId) event.preventDefault();
	});
}
