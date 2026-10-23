// Readonly view: show the option's title (e.g. "Copy field") instead of its value ("field").
// Set to false to show the raw stored value, as in the mockup.
const SHOW_OPTION_TITLES = true;

const READONLY_ON_TEXT = "On";
const READONLY_OFF_TEXT = "Off";
const READONLY_EMPTY_TEXT = "—";

class PktsFormControl extends HTMLElement {
	static formAssociated = true;

	static get observedAttributes() {
		return ["label", "description", "error", "required", "disabled", "examples", "readonly"];
	}

	constructor() {
		super();

		this._internals = this.attachInternals?.();

		this._componentName = "";
		this._controlProps = {};
		this._value = undefined;

		this._label = "";
		this._description = "";
		this._error = "";
		this._examples = undefined;

		this._required = false;
		this._disabled = false;
		this._readonly = false;
		this._dirty = false;

		this._eventName = "change";
		this._control = null;
		this._renderId = 0;

		this._onChangeListener = null;

		// Editable structure
		this.containerEl = null;
		this.labelEl = null;
		this.messageEl = null;

		// Readonly structure
		this.readonlyLabelEl = null;
		this.valueEl = null;

		this._handleChange = this._handleChange.bind(this);
		this._handleBlur = this._handleBlur.bind(this);
	}

	connectedCallback() {
		// Pick up readonly from a parent <json-form readonly> if no prop was passed
		if (!this._readonly && this._inReadonlyForm()) {
			this._readonly = true;
			this.toggleAttribute("readonly", true);
		}

		this._renderStructure();
		this._syncPresentation();
		this._renderControl();
	}

	disconnectedCallback() {
		this._removeEventListeners();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case "label":
				this._label = newValue ?? "";
				break;
			case "description":
				this._description = newValue ?? "";
				break;
			case "error":
				this._error = this._normalizeError(newValue);
				break;
			case "required":
				this._required = newValue !== null;
				break;
			case "disabled":
				this._disabled = newValue !== null;
				break;
			case "examples":
				this._examples = this._parseExamples(newValue);
				break;
			case "readonly":
				// The setter ignores the call if nothing changed, so there is no loop
				this.readonly = newValue !== null && newValue !== "false";
				return;
		}

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	/*
	 * onChange
	 *
	 * The renderer returns `onChange` in its props. Registering it as a real
	 * "change" listener on this element guarantees it receives the event
	 * dispatched by _commit(), however the props get applied. If json-form
	 * also adds the same function with addEventListener, the DOM ignores the
	 * duplicate registration.
	 */

	set onChange(handler) {
		if (this._onChangeListener) {
			this.removeEventListener("change", this._onChangeListener);
		}

		this._onChangeListener = typeof handler === "function" ? handler : null;

		if (this._onChangeListener) {
			this.addEventListener("change", this._onChangeListener);
		}
	}

	get onChange() {
		return this._onChangeListener;
	}

	/*
	 * Readonly
	 *
	 * true  -> renders only the label and the value as text (no inner input)
	 * false -> renders the normal editable control
	 */

	set readonly(value) {
		const next = this._toBoolean(value);

		if (next === this._readonly) return;

		this._readonly = next;
		this.toggleAttribute("readonly", next);

		if (this.isConnected) this._rebuild();
	}

	get readonly() {
		return this._readonly;
	}

	/*
	 * Component name
	 */

	set componentName(value) {
		const nextValue = value ?? "";

		if (nextValue === this._componentName) return;

		this._componentName = nextValue;

		if (this.isConnected) {
			this._renderControl();
		}
	}

	get componentName() {
		return this._componentName;
	}

	/*
	 * Properties forwarded to the inner pkts-* component
	 */

	set controlProps(value) {
		this._controlProps = value && typeof value === "object" ? value : {};

		this._syncControlProps();

		// Readonly text may depend on `options` (to show an option's title)
		if (this._readonly) this._syncPresentation();
	}

	get controlProps() {
		return this._controlProps;
	}

	/*
	 * Event emitted by the inner pkts-* component
	 */

	set eventName(value) {
		const nextEventName = value || "change";

		if (nextEventName === this._eventName) return;

		this._removeEventListeners();
		this._eventName = nextEventName;
		this._addEventListeners();
	}

	get eventName() {
		return this._eventName;
	}

	/*
	 * Value
	 *
	 * Text-like controls: the raw value.
	 * Switches / checkboxes: a real boolean.
	 * Mirrored to the `value` attribute (one way) for inspection and CSS.
	 */

	set value(value) {
		this._value = this._isToggle() ? this._isOn(value) : value;

		this._reflectValueAttribute();
		this._syncValue();
		this._syncFormValue();
		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	get value() {
		return this._value;
	}

	/*
	 * Label
	 */

	set label(value) {
		this._label = value === undefined || value === null ? "" : String(value);

		this._reflectStringAttribute("label", this._label);

		this._syncPresentation();
	}

	get label() {
		return this._label;
	}

	/*
	 * Description
	 */

	set description(value) {
		this._description = value === undefined || value === null ? "" : String(value);

		this._reflectStringAttribute("description", this._description);

		this._syncPresentation();
	}

	get description() {
		return this._description;
	}

	/*
	 * Examples
	 */

	set examples(value) {
		this._examples = value;

		if (value === undefined || value === null) {
			this.removeAttribute("examples");
		} else {
			const serialized = typeof value === "string" ? value : JSON.stringify(value);

			if (this.getAttribute("examples") !== serialized) {
				this.setAttribute("examples", serialized);
			}
		}

		this._syncPresentation();
	}

	get examples() {
		return this._examples;
	}

	/*
	 * Error
	 */

	set error(value) {
		this._error = this._normalizeError(value);

		this._reflectStringAttribute("error", this._error);

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	get error() {
		return this._error;
	}

	/*
	 * Required
	 */

	set required(value) {
		this._required = this._toBoolean(value);

		this.toggleAttribute("required", this._required);

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	get required() {
		return this._required;
	}

	/*
	 * Disabled
	 */

	set disabled(value) {
		this._disabled = this._toBoolean(value);

		this.toggleAttribute("disabled", this._disabled);

		this._syncControlState();
		this._syncValidity();
	}

	get disabled() {
		return this._disabled;
	}

	/*
	 * Native form name
	 */

	set name(value) {
		if (value === undefined || value === null) {
			this.removeAttribute("name");
		} else {
			this.setAttribute("name", String(value));
		}
	}

	get name() {
		return this.getAttribute("name") ?? "";
	}

	get control() {
		return this._control;
	}

	get dirty() {
		return this._dirty;
	}

	/*
	 * Programmatic update that behaves like a user edit:
	 * updates the inner control, then emits the same "change" event.
	 */
	setValue(value) {
		const next = this._isToggle() ? this._isOn(value) : value;

		this._value = next;
		this._syncValue();
		this._commit(next);
	}

	/*
	 * Render
	 *
	 * Editable:
	 * <div class="form-container">
	 *   <pkts-input-label></pkts-input-label>
	 *   <pkts-*></pkts-*>
	 *   <pkts-input-message></pkts-input-message>
	 * </div>
	 *
	 * Readonly:
	 * <div class="form-container form-container--readonly">
	 *   <span class="readonly-label"></span>
	 *   <span class="readonly-value"></span>
	 * </div>
	 */

	_renderStructure() {
		if (this.containerEl?.isConnected) return;

		const container = document.createElement("div");

		if (this._readonly) {
			container.className = "form-container form-container--readonly";

			const label = document.createElement("span");
			label.className = "readonly-label";

			const value = document.createElement("span");
			value.className = "readonly-value";

			container.append(label, value);
			this.replaceChildren(container);

			this.containerEl = container;
			this.readonlyLabelEl = label;
			this.valueEl = value;
			this.labelEl = null;
			this.messageEl = null;
			return;
		}

		container.className = "form-container";

		const label = document.createElement("pkts-input-label");
		const message = document.createElement("pkts-input-message");

		container.append(label, message);
		this.replaceChildren(container);

		this.containerEl = container;
		this.labelEl = label;
		this.messageEl = message;
		this.readonlyLabelEl = null;
		this.valueEl = null;
	}

	// Tears down the current structure and builds the one for the current mode
	_rebuild() {
		this._renderId++; // cancel any pending async control render
		this._removeEventListeners();
		this._control?.remove();
		this._control = null;

		this.containerEl = null;
		this.labelEl = null;
		this.messageEl = null;
		this.readonlyLabelEl = null;
		this.valueEl = null;

		this._renderStructure();
		this._syncPresentation();
		this._renderControl();
	}

	async _renderControl() {
		const componentName = this._componentName;
		const renderId = ++this._renderId;

		this._renderStructure();

		// Readonly: no inner input. The wrapper keeps the value for form state.
		if (this._readonly) {
			this._syncPresentation();
			this._syncFormValue();
			this._syncValidity();
			return;
		}

		if (!componentName) return;

		await customElements.whenDefined(componentName);

		if (renderId !== this._renderId || componentName !== this._componentName) {
			return;
		}

		this._removeEventListeners();
		this._control?.remove();

		const control = document.createElement(componentName);

		this._control = control;

		this.containerEl.insertBefore(control, this.messageEl);

		this._addEventListeners();
		this._syncControlProps();
		this._syncValue();
		this._syncControlState();
		this._syncPresentation();
		this._syncFormValue();
		this._syncValidity();
	}

	/*
	 * Label and message presentation
	 */

	_syncPresentation() {
		if (this._readonly) {
			this._syncReadonlyPresentation();
			return;
		}

		if (!this.labelEl || !this.messageEl) return;

		const description = this._buildDesc();
		const visibleError = this._getVisibleError();

		this.labelEl.label = this._label;
		this.labelEl.desc = description;

		this.labelEl.setAttribute("label", this._label);

		if (description) {
			this.labelEl.setAttribute("desc", description);
		} else {
			this.labelEl.removeAttribute("desc");
		}

		this.messageEl.error = visibleError;

		if (visibleError) {
			this.messageEl.setAttribute("error", visibleError);
		} else {
			this.messageEl.removeAttribute("error");
		}

		this.messageEl.required = this._required;
		this.messageEl.toggleAttribute("required", this._required);

		this.toggleAttribute("data-dirty", this._dirty);
		this.toggleAttribute("data-invalid", Boolean(visibleError));
	}

	_syncReadonlyPresentation() {
		if (!this.readonlyLabelEl || !this.valueEl) return;

		const text = this._displayValue();
		const isEmpty = text === "";

		if (this.readonlyLabelEl.textContent !== this._label) {
			this.readonlyLabelEl.textContent = this._label;
		}

		const shown = isEmpty ? READONLY_EMPTY_TEXT : text;

		if (this.valueEl.textContent !== shown) {
			this.valueEl.textContent = shown;
		}

		// Hook for CSS, e.g. hiding optional fields that were left empty
		this.toggleAttribute("data-empty", isEmpty);

		// No editing, so no dirty or invalid state
		this.toggleAttribute("data-dirty", false);
		this.toggleAttribute("data-invalid", false);
	}

	// Text shown in readonly mode. Returns "" when there is nothing to show.
	_displayValue() {
		const value = this._value;

		if (this._isToggle()) {
			return this._isOn(value) ? READONLY_ON_TEXT : READONLY_OFF_TEXT;
		}

		if (this._isEmpty(value)) return "";

		if (SHOW_OPTION_TITLES) {
			const title = this._optionTitle(value);
			if (title !== undefined) return title;
		}

		if (Array.isArray(value)) return value.join(", ");

		if (typeof value === "object") {
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}

	// Looks up the title for a value in the select's options (oneOf / enum), if any
	_optionTitle(value) {
		let options = this._controlProps?.options;

		if (typeof options === "string") {
			try {
				options = JSON.parse(options);
			} catch {
				return undefined;
			}
		}

		if (!Array.isArray(options)) return undefined;

		const match = options.find((option) => {
			const optionValue =
				option && typeof option === "object" ? option.const ?? option.value : option;

			return optionValue === value;
		});

		if (match && typeof match === "object") {
			return String(match.title ?? match.label ?? match.const ?? match.value);
		}

		return undefined;
	}

	_buildDesc() {
		const parts = [];

		if (this._description) {
			parts.push(this._description);
		}

		const examples = Array.isArray(this._examples)
			? this._examples
			: this._examples !== undefined && this._examples !== null && this._examples !== ""
			  ? [this._examples]
			  : [];

		if (examples.length) {
			const formatted = examples
				.map((example) => {
					if (typeof example === "string") return example;

					try {
						return JSON.stringify(example);
					} catch {
						return String(example);
					}
				})
				.join(", ");

			parts.push(`e.g. ${formatted}`);
		}

		return parts.join(" — ");
	}

	/*
	 * Forward component-specific properties
	 */

	_syncControlProps() {
		if (!this._control) return;

		for (const [property, value] of Object.entries(this._controlProps)) {
			if (value !== undefined) {
				this._control[property] = value;
			}
		}

		this._syncControlState();
	}

	// Switches and checkboxes get `checked`, everything else gets `value`
	_syncValue() {
		if (!this._control) return;

		if (this._isToggle()) {
			this._control.checked = this._isOn(this._value);
			return;
		}

		this._control.value = this._value;
	}

	/*
	 * One-way mirror of _value to the `value` attribute.
	 * `value` is intentionally NOT in observedAttributes, so the attribute
	 * can never write back into _value.
	 */
	_reflectValueAttribute() {
		const v = this._value;

		let attr = null;
		if (v !== undefined && v !== null && v !== "") {
			attr = typeof v === "object" ? JSON.stringify(v) : String(v);
		}

		if (attr === null) {
			this.removeAttribute("value");
		} else if (this.getAttribute("value") !== attr) {
			this.setAttribute("value", attr);
		}
	}

	/*
	 * Send required/error/disabled state to pkts-*
	 */

	_syncControlState() {
		if (!this._control) return;

		const visibleError = this._getVisibleError();
		const invalid = Boolean(visibleError);

		this._control.disabled = this._disabled;
		// Some Packets controls (seen with pkts-input-checkbox) disable their inner
		// <input> but don't re-enable it when disabled goes back to false.
		if (!this._disabled) {
			this._control.querySelectorAll("input:disabled").forEach((input) => {
				input.disabled = false;
			});
		}
		this._control.required = this._required;
		this._control.error = visibleError;

		this._control.toggleAttribute("required", this._required);

		if (this._required) {
			this._control.setAttribute("aria-required", "true");
		} else {
			this._control.removeAttribute("aria-required");
		}

		if (invalid) {
			this._control.setAttribute("error", visibleError);
			this._control.setAttribute("aria-invalid", "true");
		} else {
			this._control.removeAttribute("error");
			this._control.removeAttribute("aria-invalid");
		}

		if ("invalid" in this._control) {
			this._control.invalid = invalid;
		}

		if ("state" in this._control) {
			this._control.state = invalid ? "error" : undefined;
		}
	}

	/*
	 * Switch / checkbox support
	 */

	_isToggle() {
		return /switch|checkbox/i.test(this._componentName);
	}

	// Accepts booleans plus the legacy "on" string
	_isOn(value) {
		return value === true || value === "on" || value === "true" || value === 1;
	}

	// Real checked state of the inner control, or undefined if it can't be found
	_readChecked(event) {
		// 1. The element that fired the event (the native input, even inside shadow DOM)
		const source = event?.composedPath?.().find((el) => typeof el?.checked === "boolean");
		if (source) return source.checked;

		// 2. The pkts-* control's own property
		if (typeof this._control?.checked === "boolean") return this._control.checked;

		// 3. Event detail
		if (typeof event?.detail?.checked === "boolean") return event.detail.checked;
		if (typeof event?.detail?.value === "boolean") return event.detail.value;

		// 4. A checkbox inside the control
		const inner =
			this._control?.querySelector?.("input[type='checkbox']") ??
			this._control?.shadowRoot?.querySelector?.("input[type='checkbox']");
		if (typeof inner?.checked === "boolean") return inner.checked;

		return undefined;
	}

	/*
	 * Events
	 */

	_addEventListeners() {
		if (!this._control) return;

		if (this._eventName) {
			this._control.addEventListener(this._eventName, this._handleChange);
		}

		// Capture blur events from an input inside shadow DOM
		this._control.addEventListener("blur", this._handleBlur, true);
	}

	_removeEventListeners() {
		if (!this._control) return;

		if (this._eventName) {
			this._control.removeEventListener(this._eventName, this._handleChange);
		}

		this._control.removeEventListener("blur", this._handleBlur, true);
	}

	// Handles the inner pkts-* event, then re-emits one normalized event via _commit()
	_handleChange(event) {
		// The inner event stops here; only the normalized event leaves this element
		event.stopPropagation();

		let value;

		if (this._isToggle()) {
			const checked = this._readChecked(event);

			// Can't tell the state, so don't guess
			if (checked === undefined) {
				console.warn(`[${this.name}] could not read checked state`, event);
				return;
			}

			value = checked;

			// Same value as before: a duplicate inner event
			if (value === this._value) return;
		} else {
			value = this._getEventValue(event);
		}

		this._value = value;
		this._commit(value, event);
	}

	/*
	 * The single place that emits "change".
	 *
	 * _value is already updated, so an ancestor listener can read either
	 *   event.detail.value
	 *   event.target.value   (target is this pkts-form-control)
	 * and both return the same thing.
	 */
	_commit(value, originalEvent) {
		this._dirty = true;

		this._reflectValueAttribute();
		this._syncFormValue();
		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();

		this.dispatchEvent(
			new CustomEvent("change", {
				bubbles: true,
				composed: true,
				detail: {
					value,
					name: this.name,
					...(originalEvent ? { originalEvent } : {}),
				},
			}),
		);
	}

	/*
	 * Blur marks the field dirty. It also acts as a safety net: if the inner
	 * control holds a value the wrapper never received (for example because the
	 * inner component emits an event other than `eventName`), sync it now and
	 * emit "change" so the renderer and JSON Forms get it.
	 */
	_handleBlur() {
		if (!this._isToggle() && this._control) {
			const current = this._control.value;

			if (current !== undefined && !this._sameValue(current, this._value)) {
				this._value = current;
				this._commit(current);
				return;
			}
		}

		this.markDirty();
	}

	// Treats undefined, null and "" as the same "empty" value; compares objects by content
	_sameValue(a, b) {
		if (this._isEmpty(a) && this._isEmpty(b)) return true;

		if (typeof a === "object" || typeof b === "object") {
			try {
				return JSON.stringify(a) === JSON.stringify(b);
			} catch {
				return false;
			}
		}

		return a === b;
	}

	_getEventValue(event) {
		// CustomEvent({ detail: { value } })
		if (event.detail && typeof event.detail === "object" && "value" in event.detail) {
			return event.detail.value;
		}

		// CustomEvent({ detail: value })
		if (
			event.detail !== undefined &&
			event.detail !== null &&
			typeof event.detail !== "object"
		) {
			return event.detail;
		}

		// Packets component public value
		if (this._control?.value !== undefined) {
			return this._control.value;
		}

		return event.target?.value;
	}

	/*
	 * Visible validation error
	 */

	_getVisibleError() {
		if (this._readonly) return "";

		if (!this._dirty) return "";

		if (this._error) return this._error;

		if (this._required && this._isEmpty(this._value)) {
			return "This field is required.";
		}

		return "";
	}

	/*
	 * Native form value and validity
	 */

	_syncFormValue() {
		if (!this._internals) return;

		const value = this._value;

		if (this._isToggle()) {
			// Native checkbox semantics: submitted only when on
			this._internals.setFormValue(this._isOn(value) ? "on" : null);
		} else if (value === undefined || value === null) {
			this._internals.setFormValue("");
		} else if (typeof value === "object") {
			this._internals.setFormValue(JSON.stringify(value));
		} else {
			this._internals.setFormValue(String(value));
		}
	}

	_syncValidity() {
		if (!this._internals) return;

		// A readonly field can't be edited, so it never blocks validation
		if (this._disabled || this._readonly) {
			this._internals.setValidity({});
			return;
		}

		if (this._required && this._isEmpty(this._value)) {
			this._internals.setValidity(
				{ valueMissing: true },
				this._error || "This field is required.",
			);
			return;
		}

		if (this._error) {
			this._internals.setValidity({ customError: true }, this._error);
			return;
		}

		this._internals.setValidity({});
	}

	formDisabledCallback(disabled) {
		this.disabled = disabled;
	}

	formResetCallback() {
		this._dirty = false;

		this.value = this._isToggle()
			? false
			: this._controlProps.defaultValue ?? this._controlProps.value ?? "";

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	/*
	 * Dirty state
	 */

	markDirty() {
		this._dirty = true;

		if (typeof this._control?.markDirty === "function") {
			this._control.markDirty();
		}

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	markPristine() {
		this._dirty = false;

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	/*
	 * Public form methods
	 */

	checkValidity() {
		this._syncValidity();

		if (this._internals?.checkValidity) {
			return this._internals.checkValidity();
		}

		if (typeof this._control?.checkValidity === "function") {
			return this._control.checkValidity();
		}

		return true;
	}

	reportValidity() {
		this.markDirty();
		this._syncValidity();

		if (this._internals?.reportValidity) {
			return this._internals.reportValidity();
		}

		if (typeof this._control?.reportValidity === "function") {
			return this._control.reportValidity();
		}

		return true;
	}

	focus(options) {
		this._control?.focus(options);
	}

	/*
	 * Helpers
	 */

	_inReadonlyForm() {
		const form = this.closest("json-form");

		return Boolean(form?.hasAttribute("readonly")) && form.getAttribute("readonly") !== "false";
	}

	_parseExamples(value) {
		if (value === undefined || value === null || value === "") return undefined;

		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	_normalizeError(error) {
		if (error === undefined || error === null || error === false) return "";

		if (Array.isArray(error)) {
			return error
				.map((item) => this._normalizeError(item))
				.filter(Boolean)
				.join(", ");
		}

		if (typeof error === "object") {
			if (error.message) return String(error.message);

			try {
				return JSON.stringify(error);
			} catch {
				return String(error);
			}
		}

		return String(error);
	}

	_isEmpty(value) {
		return (
			value === undefined ||
			value === null ||
			value === "" ||
			(Array.isArray(value) && value.length === 0)
		);
	}

	_toBoolean(value) {
		return value === true || value === "" || value === "true" || value === 1 || value === "1";
	}

	_reflectStringAttribute(name, value) {
		if (value === undefined || value === null || value === "") {
			if (this.hasAttribute(name)) {
				this.removeAttribute(name);
			}
			return;
		}

		const stringValue = String(value);

		if (this.getAttribute(name) !== stringValue) {
			this.setAttribute(name, stringValue);
		}
	}
}

if (!customElements.get("pkts-form-control")) {
	customElements.define("pkts-form-control", PktsFormControl);
}

// TODO: Go back to this form control once packets have read only states

// class PktsFormControl extends HTMLElement {
// 	static formAssociated = true;

// 	static get observedAttributes() {
// 		return ["label", "description", "error", "required", "disabled", "examples"];
// 	}

// 	constructor() {
// 		super();

// 		this._internals = this.attachInternals?.();

// 		this._componentName = "";
// 		this._controlProps = {};
// 		this._value = undefined;

// 		this._label = "";
// 		this._description = "";
// 		this._error = "";
// 		this._examples = undefined;

// 		this._required = false;
// 		this._disabled = false;
// 		this._dirty = false;

// 		this._eventName = "change";
// 		this._control = null;
// 		this._renderId = 0;

// 		this._onChangeListener = null;

// 		this.containerEl = null;
// 		this.labelEl = null;
// 		this.messageEl = null;

// 		this._handleChange = this._handleChange.bind(this);
// 		this._handleBlur = this._handleBlur.bind(this);
// 	}

// 	connectedCallback() {
// 		this._renderStructure();
// 		this._syncPresentation();
// 		this._renderControl();
// 	}

// 	disconnectedCallback() {
// 		this._removeEventListeners();
// 	}

// 	attributeChangedCallback(name, oldValue, newValue) {
// 		if (oldValue === newValue) return;

// 		switch (name) {
// 			case "label":
// 				this._label = newValue ?? "";
// 				break;
// 			case "description":
// 				this._description = newValue ?? "";
// 				break;
// 			case "error":
// 				this._error = this._normalizeError(newValue);
// 				break;
// 			case "required":
// 				this._required = newValue !== null;
// 				break;
// 			case "disabled":
// 				this._disabled = newValue !== null;
// 				break;
// 			case "examples":
// 				this._examples = this._parseExamples(newValue);
// 				break;
// 		}

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	/*
// 	 * onChange
// 	 *
// 	 * The renderer returns `onChange` in its props. Registering it as a real
// 	 * "change" listener on this element guarantees it receives the event
// 	 * dispatched by _commit(), however the props get applied. If json-form
// 	 * also adds the same function with addEventListener, the DOM ignores the
// 	 * duplicate registration.
// 	 */

// 	set onChange(handler) {
// 		if (this._onChangeListener) {
// 			this.removeEventListener("change", this._onChangeListener);
// 		}

// 		this._onChangeListener = typeof handler === "function" ? handler : null;

// 		if (this._onChangeListener) {
// 			this.addEventListener("change", this._onChangeListener);
// 		}
// 	}

// 	get onChange() {
// 		return this._onChangeListener;
// 	}

// 	/*
// 	 * Component name
// 	 */

// 	set componentName(value) {
// 		const nextValue = value ?? "";

// 		if (nextValue === this._componentName) return;

// 		this._componentName = nextValue;

// 		if (this.isConnected) {
// 			this._renderControl();
// 		}
// 	}

// 	get componentName() {
// 		return this._componentName;
// 	}

// 	/*
// 	 * Properties forwarded to the inner pkts-* component
// 	 */

// 	set controlProps(value) {
// 		this._controlProps = value && typeof value === "object" ? value : {};

// 		this._syncControlProps();
// 	}

// 	get controlProps() {
// 		return this._controlProps;
// 	}

// 	/*
// 	 * Event emitted by the inner pkts-* component
// 	 */

// 	set eventName(value) {
// 		const nextEventName = value || "change";

// 		if (nextEventName === this._eventName) return;

// 		this._removeEventListeners();
// 		this._eventName = nextEventName;
// 		this._addEventListeners();
// 	}

// 	get eventName() {
// 		return this._eventName;
// 	}

// 	/*
// 	 * Value
// 	 *
// 	 * Text-like controls: the raw value.
// 	 * Switches / checkboxes: a real boolean.
// 	 * Mirrored to the `value` attribute (one way) for inspection and CSS.
// 	 */

// 	set value(value) {
// 		this._value = this._isToggle() ? this._isOn(value) : value;

// 		this._reflectValueAttribute();
// 		this._syncValue();
// 		this._syncFormValue();
// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	get value() {
// 		return this._value;
// 	}

// 	/*
// 	 * Label
// 	 */

// 	set label(value) {
// 		this._label = value === undefined || value === null ? "" : String(value);

// 		this._reflectStringAttribute("label", this._label);

// 		this._syncPresentation();
// 	}

// 	get label() {
// 		return this._label;
// 	}

// 	/*
// 	 * Description
// 	 */

// 	set description(value) {
// 		this._description = value === undefined || value === null ? "" : String(value);

// 		this._reflectStringAttribute("description", this._description);

// 		this._syncPresentation();
// 	}

// 	get description() {
// 		return this._description;
// 	}

// 	/*
// 	 * Examples
// 	 */

// 	set examples(value) {
// 		this._examples = value;

// 		if (value === undefined || value === null) {
// 			this.removeAttribute("examples");
// 		} else {
// 			const serialized = typeof value === "string" ? value : JSON.stringify(value);

// 			if (this.getAttribute("examples") !== serialized) {
// 				this.setAttribute("examples", serialized);
// 			}
// 		}

// 		this._syncPresentation();
// 	}

// 	get examples() {
// 		return this._examples;
// 	}

// 	/*
// 	 * Error
// 	 */

// 	set error(value) {
// 		this._error = this._normalizeError(value);

// 		this._reflectStringAttribute("error", this._error);

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	get error() {
// 		return this._error;
// 	}

// 	/*
// 	 * Required
// 	 */

// 	set required(value) {
// 		this._required = this._toBoolean(value);

// 		this.toggleAttribute("required", this._required);

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	get required() {
// 		return this._required;
// 	}

// 	/*
// 	 * Disabled
// 	 */

// 	set disabled(value) {
// 		this._disabled = this._toBoolean(value);

// 		this.toggleAttribute("disabled", this._disabled);

// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	get disabled() {
// 		return this._disabled;
// 	}

// 	/*
// 	 * Native form name
// 	 */

// 	set name(value) {
// 		if (value === undefined || value === null) {
// 			this.removeAttribute("name");
// 		} else {
// 			this.setAttribute("name", String(value));
// 		}
// 	}

// 	get name() {
// 		return this.getAttribute("name") ?? "";
// 	}

// 	get control() {
// 		return this._control;
// 	}

// 	get dirty() {
// 		return this._dirty;
// 	}

// 	/*
// 	 * Programmatic update that behaves like a user edit:
// 	 * updates the inner control, then emits the same "change" event.
// 	 */
// 	setValue(value) {
// 		const next = this._isToggle() ? this._isOn(value) : value;

// 		this._value = next;
// 		this._syncValue();
// 		this._commit(next);
// 	}

// 	/*
// 	 * Render:
// 	 *
// 	 * <div class="form-container">
// 	 *   <pkts-input-label></pkts-input-label>
// 	 *   <pkts-*></pkts-*>
// 	 *   <pkts-input-message></pkts-input-message>
// 	 * </div>
// 	 */

// 	_renderStructure() {
// 		if (this.containerEl?.isConnected) return;

// 		const container = document.createElement("div");
// 		container.className = "form-container";

// 		const label = document.createElement("pkts-input-label");
// 		const message = document.createElement("pkts-input-message");

// 		container.append(label, message);
// 		this.replaceChildren(container);

// 		this.containerEl = container;
// 		this.labelEl = label;
// 		this.messageEl = message;
// 	}

// 	async _renderControl() {
// 		const componentName = this._componentName;
// 		const renderId = ++this._renderId;

// 		if (!componentName) return;

// 		this._renderStructure();

// 		await customElements.whenDefined(componentName);

// 		if (renderId !== this._renderId || componentName !== this._componentName) {
// 			return;
// 		}

// 		this._removeEventListeners();
// 		this._control?.remove();

// 		const control = document.createElement(componentName);

// 		this._control = control;

// 		this.containerEl.insertBefore(control, this.messageEl);

// 		this._addEventListeners();
// 		this._syncControlProps();
// 		this._syncValue();
// 		this._syncControlState();
// 		this._syncPresentation();
// 		this._syncFormValue();
// 		this._syncValidity();
// 	}

// 	/*
// 	 * Label and message presentation
// 	 */

// 	_syncPresentation() {
// 		if (!this.labelEl || !this.messageEl) return;

// 		const description = this._buildDesc();
// 		const visibleError = this._getVisibleError();

// 		this.labelEl.label = this._label;
// 		this.labelEl.desc = description;

// 		this.labelEl.setAttribute("label", this._label);

// 		if (description) {
// 			this.labelEl.setAttribute("desc", description);
// 		} else {
// 			this.labelEl.removeAttribute("desc");
// 		}

// 		this.messageEl.error = visibleError;

// 		if (visibleError) {
// 			this.messageEl.setAttribute("error", visibleError);
// 		} else {
// 			this.messageEl.removeAttribute("error");
// 		}

// 		this.messageEl.required = this._required;
// 		this.messageEl.toggleAttribute("required", this._required);

// 		this.toggleAttribute("data-dirty", this._dirty);
// 		this.toggleAttribute("data-invalid", Boolean(visibleError));
// 	}

// 	_buildDesc() {
// 		const parts = [];

// 		if (this._description) {
// 			parts.push(this._description);
// 		}

// 		const examples = Array.isArray(this._examples)
// 			? this._examples
// 			: this._examples !== undefined && this._examples !== null && this._examples !== ""
// 			  ? [this._examples]
// 			  : [];

// 		if (examples.length) {
// 			const formatted = examples
// 				.map((example) => {
// 					if (typeof example === "string") return example;

// 					try {
// 						return JSON.stringify(example);
// 					} catch {
// 						return String(example);
// 					}
// 				})
// 				.join(", ");

// 			parts.push(`e.g. ${formatted}`);
// 		}

// 		return parts.join(" — ");
// 	}

// 	/*
// 	 * Forward component-specific properties
// 	 */

// 	_syncControlProps() {
// 		if (!this._control) return;

// 		for (const [property, value] of Object.entries(this._controlProps)) {
// 			if (value !== undefined) {
// 				this._control[property] = value;
// 			}
// 		}

// 		this._syncControlState();
// 	}

// 	// Switches and checkboxes get `checked`, everything else gets `value`
// 	_syncValue() {
// 		if (!this._control) return;

// 		if (this._isToggle()) {
// 			this._control.checked = this._isOn(this._value);
// 			return;
// 		}

// 		this._control.value = this._value;
// 	}

// 	/*
// 	 * One-way mirror of _value to the `value` attribute.
// 	 * `value` is intentionally NOT in observedAttributes, so the attribute
// 	 * can never write back into _value.
// 	 */
// 	_reflectValueAttribute() {
// 		const v = this._value;

// 		let attr = null;
// 		if (v !== undefined && v !== null && v !== "") {
// 			attr = typeof v === "object" ? JSON.stringify(v) : String(v);
// 		}

// 		if (attr === null) {
// 			this.removeAttribute("value");
// 		} else if (this.getAttribute("value") !== attr) {
// 			this.setAttribute("value", attr);
// 		}
// 	}

// 	/*
// 	 * Send required/error/disabled state to pkts-*
// 	 */

// 	_syncControlState() {
// 		if (!this._control) return;

// 		const visibleError = this._getVisibleError();
// 		const invalid = Boolean(visibleError);

// 		this._control.disabled = this._disabled;
// 		this._control.required = this._required;
// 		this._control.error = visibleError;

// 		this._control.toggleAttribute("required", this._required);

// 		if (this._required) {
// 			this._control.setAttribute("aria-required", "true");
// 		} else {
// 			this._control.removeAttribute("aria-required");
// 		}

// 		if (invalid) {
// 			this._control.setAttribute("error", visibleError);
// 			this._control.setAttribute("aria-invalid", "true");
// 		} else {
// 			this._control.removeAttribute("error");
// 			this._control.removeAttribute("aria-invalid");
// 		}

// 		if ("invalid" in this._control) {
// 			this._control.invalid = invalid;
// 		}

// 		if ("state" in this._control) {
// 			this._control.state = invalid ? "error" : undefined;
// 		}
// 	}

// 	/*
// 	 * Switch / checkbox support
// 	 */

// 	_isToggle() {
// 		return /switch|checkbox/i.test(this._componentName);
// 	}

// 	// Accepts booleans plus the legacy "on" string
// 	_isOn(value) {
// 		return value === true || value === "on" || value === "true" || value === 1;
// 	}

// 	// Real checked state of the inner control, or undefined if it can't be found
// 	_readChecked(event) {
// 		// 1. The element that fired the event (the native input, even inside shadow DOM)
// 		const source = event?.composedPath?.().find((el) => typeof el?.checked === "boolean");
// 		if (source) return source.checked;

// 		// 2. The pkts-* control's own property
// 		if (typeof this._control?.checked === "boolean") return this._control.checked;

// 		// 3. Event detail
// 		if (typeof event?.detail?.checked === "boolean") return event.detail.checked;
// 		if (typeof event?.detail?.value === "boolean") return event.detail.value;

// 		// 4. A checkbox inside the control
// 		const inner =
// 			this._control?.querySelector?.("input[type='checkbox']") ??
// 			this._control?.shadowRoot?.querySelector?.("input[type='checkbox']");
// 		if (typeof inner?.checked === "boolean") return inner.checked;

// 		return undefined;
// 	}

// 	/*
// 	 * Events
// 	 */

// 	_addEventListeners() {
// 		if (!this._control) return;

// 		if (this._eventName) {
// 			this._control.addEventListener(this._eventName, this._handleChange);
// 		}

// 		// Capture blur events from an input inside shadow DOM
// 		this._control.addEventListener("blur", this._handleBlur, true);
// 	}

// 	_removeEventListeners() {
// 		if (!this._control) return;

// 		if (this._eventName) {
// 			this._control.removeEventListener(this._eventName, this._handleChange);
// 		}

// 		this._control.removeEventListener("blur", this._handleBlur, true);
// 	}

// 	// Handles the inner pkts-* event, then re-emits one normalized event via _commit()
// 	_handleChange(event) {
// 		// The inner event stops here; only the normalized event leaves this element
// 		event.stopPropagation();

// 		let value;

// 		if (this._isToggle()) {
// 			const checked = this._readChecked(event);

// 			// Can't tell the state, so don't guess
// 			if (checked === undefined) {
// 				console.warn(`[${this.name}] could not read checked state`, event);
// 				return;
// 			}

// 			value = checked;

// 			// Same value as before: a duplicate inner event
// 			if (value === this._value) return;
// 		} else {
// 			value = this._getEventValue(event);
// 		}

// 		this._value = value;
// 		this._commit(value, event);
// 	}

// 	/*
// 	 * The single place that emits "change".
// 	 *
// 	 * _value is already updated, so an ancestor listener can read either
// 	 *   event.detail.value
// 	 *   event.target.value   (target is this pkts-form-control)
// 	 * and both return the same thing.
// 	 */
// 	_commit(value, originalEvent) {
// 		this._dirty = true;

// 		this._reflectValueAttribute();
// 		this._syncFormValue();
// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();

// 		this.dispatchEvent(
// 			new CustomEvent("change", {
// 				bubbles: true,
// 				composed: true,
// 				detail: {
// 					value,
// 					name: this.name,
// 					...(originalEvent ? { originalEvent } : {}),
// 				},
// 			}),
// 		);
// 	}

// 	/*
// 	 * Blur marks the field dirty. It also acts as a safety net: if the inner
// 	 * control holds a value the wrapper never received (for example because the
// 	 * inner component emits an event other than `eventName`), sync it now and
// 	 * emit "change" so the renderer and JSON Forms get it.
// 	 */
// 	_handleBlur() {
// 		if (!this._isToggle() && this._control) {
// 			const current = this._control.value;

// 			if (current !== undefined && !this._sameValue(current, this._value)) {
// 				this._value = current;
// 				this._commit(current);
// 				return;
// 			}
// 		}

// 		this.markDirty();
// 	}

// 	// Treats undefined, null and "" as the same "empty" value; compares objects by content
// 	_sameValue(a, b) {
// 		if (this._isEmpty(a) && this._isEmpty(b)) return true;

// 		if (typeof a === "object" || typeof b === "object") {
// 			try {
// 				return JSON.stringify(a) === JSON.stringify(b);
// 			} catch {
// 				return false;
// 			}
// 		}

// 		return a === b;
// 	}

// 	_getEventValue(event) {
// 		// CustomEvent({ detail: { value } })
// 		if (event.detail && typeof event.detail === "object" && "value" in event.detail) {
// 			return event.detail.value;
// 		}

// 		// CustomEvent({ detail: value })
// 		if (
// 			event.detail !== undefined &&
// 			event.detail !== null &&
// 			typeof event.detail !== "object"
// 		) {
// 			return event.detail;
// 		}

// 		// Packets component public value
// 		if (this._control?.value !== undefined) {
// 			return this._control.value;
// 		}

// 		return event.target?.value;
// 	}

// 	/*
// 	 * Visible validation error
// 	 */

// 	_getVisibleError() {
// 		if (!this._dirty) return "";

// 		if (this._error) return this._error;

// 		if (this._required && this._isEmpty(this._value)) {
// 			return "This field is required.";
// 		}

// 		return "";
// 	}

// 	/*
// 	 * Native form value and validity
// 	 */

// 	_syncFormValue() {
// 		if (!this._internals) return;

// 		const value = this._value;

// 		if (this._isToggle()) {
// 			// Native checkbox semantics: submitted only when on
// 			this._internals.setFormValue(this._isOn(value) ? "on" : null);
// 		} else if (value === undefined || value === null) {
// 			this._internals.setFormValue("");
// 		} else if (typeof value === "object") {
// 			this._internals.setFormValue(JSON.stringify(value));
// 		} else {
// 			this._internals.setFormValue(String(value));
// 		}
// 	}

// 	_syncValidity() {
// 		if (!this._internals) return;

// 		if (this._disabled) {
// 			this._internals.setValidity({});
// 			return;
// 		}

// 		if (this._required && this._isEmpty(this._value)) {
// 			this._internals.setValidity(
// 				{ valueMissing: true },
// 				this._error || "This field is required.",
// 			);
// 			return;
// 		}

// 		if (this._error) {
// 			this._internals.setValidity({ customError: true }, this._error);
// 			return;
// 		}

// 		this._internals.setValidity({});
// 	}

// 	formDisabledCallback(disabled) {
// 		this.disabled = disabled;
// 	}

// 	formResetCallback() {
// 		this._dirty = false;

// 		this.value = this._isToggle()
// 			? false
// 			: this._controlProps.defaultValue ?? this._controlProps.value ?? "";

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	/*
// 	 * Dirty state
// 	 */

// 	markDirty() {
// 		this._dirty = true;

// 		if (typeof this._control?.markDirty === "function") {
// 			this._control.markDirty();
// 		}

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	markPristine() {
// 		this._dirty = false;

// 		this._syncPresentation();
// 		this._syncControlState();
// 		this._syncValidity();
// 	}

// 	/*
// 	 * Public form methods
// 	 */

// 	checkValidity() {
// 		this._syncValidity();

// 		if (this._internals?.checkValidity) {
// 			return this._internals.checkValidity();
// 		}

// 		if (typeof this._control?.checkValidity === "function") {
// 			return this._control.checkValidity();
// 		}

// 		return true;
// 	}

// 	reportValidity() {
// 		this.markDirty();
// 		this._syncValidity();

// 		if (this._internals?.reportValidity) {
// 			return this._internals.reportValidity();
// 		}

// 		if (typeof this._control?.reportValidity === "function") {
// 			return this._control.reportValidity();
// 		}

// 		return true;
// 	}

// 	focus(options) {
// 		this._control?.focus(options);
// 	}

// 	/*
// 	 * Helpers
// 	 */

// 	_parseExamples(value) {
// 		if (value === undefined || value === null || value === "") return undefined;

// 		try {
// 			return JSON.parse(value);
// 		} catch {
// 			return value;
// 		}
// 	}

// 	_normalizeError(error) {
// 		if (error === undefined || error === null || error === false) return "";

// 		if (Array.isArray(error)) {
// 			return error
// 				.map((item) => this._normalizeError(item))
// 				.filter(Boolean)
// 				.join(", ");
// 		}

// 		if (typeof error === "object") {
// 			if (error.message) return String(error.message);

// 			try {
// 				return JSON.stringify(error);
// 			} catch {
// 				return String(error);
// 			}
// 		}

// 		return String(error);
// 	}

// 	_isEmpty(value) {
// 		return (
// 			value === undefined ||
// 			value === null ||
// 			value === "" ||
// 			(Array.isArray(value) && value.length === 0)
// 		);
// 	}

// 	_toBoolean(value) {
// 		return value === true || value === "" || value === "true" || value === 1 || value === "1";
// 	}

// 	_reflectStringAttribute(name, value) {
// 		if (value === undefined || value === null || value === "") {
// 			if (this.hasAttribute(name)) {
// 				this.removeAttribute(name);
// 			}
// 			return;
// 		}

// 		const stringValue = String(value);

// 		if (this.getAttribute(name) !== stringValue) {
// 			this.setAttribute(name, stringValue);
// 		}
// 	}
// }

// if (!customElements.get("pkts-form-control")) {
// 	customElements.define("pkts-form-control", PktsFormControl);
// }
