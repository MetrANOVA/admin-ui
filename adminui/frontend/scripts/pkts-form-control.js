class PktsFormControl extends HTMLElement {
	static formAssociated = true;

	static get observedAttributes() {
		return ["label", "description", "error", "required", "disabled", "examples"];
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
		this._dirty = false;

		this._eventName = "change";
		this._control = null;
		this._renderId = 0;

		this.containerEl = null;
		this.labelEl = null;
		this.messageEl = null;

		this._handleChange = this._handleChange.bind(this);

		this._handleBlur = this._handleBlur.bind(this);
	}

	connectedCallback() {
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
		}

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
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
	 */

	set value(value) {
		this._value = value;

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
	 * Render:
	 *
	 * <div class="form-container">
	 *   <ps-input-label></ps-input-label>
	 *   <pkts-*></pkts-*>
	 *   <ps-input-message></ps-input-message>
	 * </div>
	 */

	_renderStructure() {
		if (this.containerEl?.isConnected) return;

		const container = document.createElement("div");

		container.className = "form-container";

		const label = document.createElement("pkts-input-label");

		const message = document.createElement("pkts-input-message");

		container.append(label, message);
		this.replaceChildren(container);

		this.containerEl = container;
		this.labelEl = label;
		this.messageEl = message;
	}

	async _renderControl() {
		const componentName = this._componentName;
		const renderId = ++this._renderId;

		if (!componentName) return;

		this._renderStructure();

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
		if (!this.labelEl || !this.messageEl) return;

		const description = this._buildDesc();
		const visibleError = this._getVisibleError();

		/*
		 * ps-input-label
		 */
		this.labelEl.label = this._label;
		this.labelEl.desc = description;

		this.labelEl.setAttribute("label", this._label);

		if (description) {
			this.labelEl.setAttribute("desc", description);
		} else {
			this.labelEl.removeAttribute("desc");
		}

		/*
		 * ps-input-message
		 */
		this.messageEl.error = visibleError;

		if (visibleError) {
			this.messageEl.setAttribute("error", visibleError);
		} else {
			this.messageEl.removeAttribute("error");
		}

		this.messageEl.required = this._required;
		this.messageEl.toggleAttribute("required", this._required);

		/*
		 * Wrapper state
		 */
		this.toggleAttribute("data-dirty", this._dirty);

		this.toggleAttribute("data-invalid", Boolean(visibleError));
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
					if (typeof example === "string") {
						return example;
					}

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

		/*
		 * Reapply wrapper-managed state in case controlProps contains
		 * disabled, required or error.
		 */
		this._syncControlState();
	}

	_syncValue() {
		if (!this._control) return;

		this._control.value = this._value;
	}

	/*
	 * Send required/error/disabled state to pkts-*
	 */

	_syncControlState() {
		if (!this._control) return;

		const visibleError = this._getVisibleError();
		const invalid = Boolean(visibleError);

		/*
		 * Public properties used by Packets components.
		 */
		this._control.disabled = this._disabled;
		this._control.required = this._required;
		this._control.error = visibleError;

		/*
		 * Required state.
		 */
		this._control.toggleAttribute("required", this._required);

		if (this._required) {
			this._control.setAttribute("aria-required", "true");
		} else {
			this._control.removeAttribute("aria-required");
		}

		/*
		 * Error state.
		 */
		if (invalid) {
			this._control.setAttribute("error", visibleError);

			this._control.setAttribute("aria-invalid", "true");
		} else {
			this._control.removeAttribute("error");
			this._control.removeAttribute("aria-invalid");
		}

		/*
		 * Some Packets components may expose these additional APIs.
		 */
		if ("invalid" in this._control) {
			this._control.invalid = invalid;
		}

		if ("state" in this._control) {
			this._control.state = invalid ? "error" : undefined;
		}
	}

	/*
	 * Events
	 */

	_addEventListeners() {
		if (!this._control) return;

		if (this._eventName) {
			this._control.addEventListener(this._eventName, this._handleChange);
		}

		/*
		 * Capture blur events from an input inside shadow DOM.
		 */
		this._control.addEventListener("blur", this._handleBlur, true);
	}

	_removeEventListeners() {
		if (!this._control) return;

		if (this._eventName) {
			this._control.removeEventListener(this._eventName, this._handleChange);
		}

		this._control.removeEventListener("blur", this._handleBlur, true);
	}

	_handleChange(event) {
		/*
		 * Prevent the original inner event from also reaching the
		 * renderer. The wrapper emits one normalized event below.
		 */
		event.stopPropagation();

		const value = this._getEventValue(event);

		this._value = value;
		this._dirty = true;

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
					originalEvent: event,
				},
			}),
		);
	}

	_handleBlur() {
		this.markDirty();
	}

	_getEventValue(event) {
		/*
		 * CustomEvent({ detail: { value } })
		 */
		if (event.detail && typeof event.detail === "object" && "value" in event.detail) {
			return event.detail.value;
		}

		/*
		 * CustomEvent({ detail: value })
		 */
		if (
			event.detail !== undefined &&
			event.detail !== null &&
			typeof event.detail !== "object"
		) {
			return event.detail;
		}

		/*
		 * Packets component public value.
		 */
		if (this._control?.value !== undefined) {
			return this._control.value;
		}

		return event.target?.value;
	}

	/*
	 * Visible validation error
	 */

	_getVisibleError() {
		if (!this._dirty) {
			return "";
		}

		if (this._error) {
			return this._error;
		}

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

		if (value === undefined || value === null) {
			this._internals.setFormValue("");
		} else if (typeof value === "object") {
			this._internals.setFormValue(JSON.stringify(value));
		} else {
			this._internals.setFormValue(String(value));
		}
	}

	_syncValidity() {
		if (!this._internals) return;

		if (this._disabled) {
			this._internals.setValidity({});
			return;
		}

		if (this._required && this._isEmpty(this._value)) {
			this._internals.setValidity(
				{
					valueMissing: true,
				},
				this._error || "This field is required.",
			);

			return;
		}

		if (this._error) {
			this._internals.setValidity(
				{
					customError: true,
				},
				this._error,
			);

			return;
		}

		this._internals.setValidity({});
	}

	formDisabledCallback(disabled) {
		this.disabled = disabled;
	}

	formResetCallback() {
		this._dirty = false;

		this.value = this._controlProps.defaultValue ?? this._controlProps.value ?? "";

		this._syncPresentation();
		this._syncControlState();
		this._syncValidity();
	}

	/*
	 * Dirty state
	 */

	markDirty() {
		this._dirty = true;

		/*
		 * Forward dirty state to Packets if its component supports it.
		 */
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

	_parseExamples(value) {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}

		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	_normalizeError(error) {
		if (error === undefined || error === null || error === false) {
			return "";
		}

		if (Array.isArray(error)) {
			return error
				.map((item) => this._normalizeError(item))
				.filter(Boolean)
				.join(", ");
		}

		if (typeof error === "object") {
			if (error.message) {
				return String(error.message);
			}

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
