export class PktsFormActions extends HTMLElement {
	static get observedAttributes() {
		return ["save-label", "cancel-label", "disabled", "save-disabled", "cancel-disabled"];
	}

	constructor() {
		super();

		this.cancelButton = null;
		this.saveButton = null;

		this._handleSave = this._handleSave.bind(this);

		this._handleCancel = this._handleCancel.bind(this);
	}

	connectedCallback() {
		this.render();
	}

	disconnectedCallback() {
		this._removeEventListeners();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || !this.isConnected) {
			return;
		}

		/*
		 * Disabled changes do not require rebuilding the HTML.
		 */
		if (name === "disabled" || name === "save-disabled" || name === "cancel-disabled") {
			this._syncDisabledState();
			return;
		}

		/*
		 * Label changes affect the markup.
		 */
		this.render();
	}

	/*
	 * Labels
	 */

	get saveLabel() {
		return this.getAttribute("save-label") || "Save";
	}

	set saveLabel(value) {
		this.setAttribute("save-label", value || "Save");
	}

	get cancelLabel() {
		return this.getAttribute("cancel-label") || "Cancel";
	}

	set cancelLabel(value) {
		this.setAttribute("cancel-label", value || "Cancel");
	}

	/*
	 * Disabled state
	 *
	 * `disabled` disables both buttons.
	 * The other properties disable one button individually.
	 */

	get disabled() {
		return this.hasAttribute("disabled");
	}

	set disabled(value) {
		this.toggleAttribute("disabled", this._toBoolean(value));
	}

	get saveDisabled() {
		return this.disabled || this.hasAttribute("save-disabled");
	}

	set saveDisabled(value) {
		this.toggleAttribute("save-disabled", this._toBoolean(value));
	}

	get cancelDisabled() {
		return this.disabled || this.hasAttribute("cancel-disabled");
	}

	set cancelDisabled(value) {
		this.toggleAttribute("cancel-disabled", this._toBoolean(value));
	}

	get form() {
		const formId = this.getAttribute("form");

		return formId ? document.getElementById(formId) : this.closest("form");
	}

	render() {
		this._removeEventListeners();

		/*
		 * No disabled interpolation is needed here.
		 */
		this.innerHTML = `
			<div class="pipeline-actions">
				<pkts-button
					class="
						pipeline-action
						pipeline-action--cancel
					"
					variant="secondary"
					type="button"
					aria-label="${this._escapeAttribute(this.cancelLabel)}"
					data-action="cancel"
				>
					<i
						data-lucide="x"
						aria-hidden="true"
					></i>
                    ${this._escapeHtml(this.cancelLabel)}
				</pkts-button>

				<pkts-button
					class="
						pipeline-action
						pipeline-action--save
					"
					variant="primary"
					type="button"
					aria-label="${this._escapeAttribute(this.saveLabel)}"
					data-action="save"
				>
					<i
						data-lucide="save"
						aria-hidden="true"
					></i>
                    ${this._escapeHtml(this.saveLabel)}
				</pkts-button>
			</div>
		`;

		this.cancelButton = this.querySelector('[data-action="cancel"]');

		this.saveButton = this.querySelector('[data-action="save"]');

		this._syncDisabledState();
		this._addEventListeners();
		// this._createLucideIcons();
	}

	_syncDisabledState() {
		this._setButtonDisabled(this.saveButton, this.saveDisabled);

		this._setButtonDisabled(this.cancelButton, this.cancelDisabled);
	}

	_setButtonDisabled(button, disabled) {
		if (!button) {
			return;
		}

		/*
		 * Set both the property and attribute so this works whether
		 * pkts-button reacts to properties or attributes.
		 */
		button.disabled = disabled;
		button.toggleAttribute("disabled", disabled);

		button.setAttribute("aria-disabled", String(disabled));
	}

	_addEventListeners() {
		this.cancelButton?.addEventListener("click", this._handleCancel);

		this.saveButton?.addEventListener("click", this._handleSave);
	}

	_removeEventListeners() {
		this.cancelButton?.removeEventListener("click", this._handleCancel);

		this.saveButton?.removeEventListener("click", this._handleSave);
	}

	_handleSave(originalEvent) {
		if (this.saveDisabled) {
			return;
		}

		const form = this.form;

		// SOME SAVE LOGIC
	}

	_handleCancel(originalEvent) {
		if (this.cancelDisabled) {
			return;
		}

		const form = this.form;

		// SOME CANCEL LOGIC
	}

	_toBoolean(value) {
		return !(
			value === false ||
			value === null ||
			value === undefined ||
			value === "false" ||
			value === 0 ||
			value === "0"
		);
	}

	_escapeHtml(value) {
		const element = document.createElement("div");

		element.textContent = String(value);
		return element.innerHTML;
	}

	_escapeAttribute(value) {
		return this._escapeHtml(value).replace(/"/g, "&quot;");
	}
}

if (!customElements.get("pkts-form-actions")) {
	customElements.define("pkts-form-actions", PktsFormActions);
}
