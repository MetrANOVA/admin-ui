// pkts-select.js

export class PKTSSelect extends HTMLElement {
	static get observedAttributes() {
		return ["options", "value", "placeholder", "disabled", "required", "label", "error"];
	}

	constructor() {
		super();

		/*
		 * Keep the markup in the light DOM so global Packets/custom
		 * styles can reach it.
		 */
		this.slotEl = `
			<div class="ps-dropdown">
				<div
					class="ps-wrapper"
					aria-expanded="false"
				>
					<input
						type="search"
						role="combobox"
						aria-autocomplete="list"
						aria-haspopup="listbox"
						aria-expanded="false"
						autocomplete="off"
					/>

					<ps-button
						id="down-btn"
						type="button"
						righticon="chevron-down"
						theme="Icon-Simple"
						aria-label="Open options"
					></ps-button>
				</div>

				<ul
					class="ps-options"
					role="listbox"
				></ul>
			</div>
		`;

		this.inputEl = null;
		this.wrapperEl = null;
		this.optionsEl = null;
		this.actionBtn = null;

		this._options = [];
		this._value = undefined;
		this._placeholder = "";
		this._label = "";
		this._error = "";

		this._disabled = false;
		this._required = false;

		this._renderScheduled = false;
		this._listenersAttached = false;

		this._handleKeydownBound = this._handleKeydown.bind(this);

		this._handleInputBound = this._handleInput.bind(this);

		this._handleInputClickBound = this._handleInputClick.bind(this);

		this._handleActionClickBound = this._handleActionClick.bind(this);

		this._handleOptionClickBound = this._handleOptionClick.bind(this);

		this._handleOutsideClickBound = this._handleOutsideClick.bind(this);
	}

	/*
	 * Lifecycle
	 */

	connectedCallback() {
		this._renderStructure();
		this._cacheElements();
		this._attachEventListeners();
		this._scheduleRender();
	}

	disconnectedCallback() {
		this._detachEventListeners();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) {
			return;
		}

		switch (name) {
			case "options":
				this._options = this._normalizeOptions(newValue);
				break;

			case "value":
				this._value = newValue === null ? undefined : this.parseValue(newValue);
				break;

			case "placeholder":
				this._placeholder = newValue ?? "";
				break;

			case "label":
				this._label = newValue ?? "";
				break;

			case "error":
				this._error = newValue ?? "";
				break;

			case "disabled":
				this._disabled = newValue !== null;
				break;

			case "required":
				this._required = newValue !== null;
				break;
		}

		this._scheduleRender();
	}

	/*
	 * Options
	 *
	 * Supports:
	 *
	 * ["a", "b"]
	 *
	 * [
	 *   { "const": "a", "title": "Option A" },
	 *   { "const": "b", "title": "Option B" }
	 * ]
	 *
	 * [
	 *   { "value": "a", "label": "Option A" }
	 * ]
	 */

	get options() {
		return this._options;
	}

	set options(value) {
		const normalized = this._normalizeOptions(value);

		this._options = normalized;

		const serialized = JSON.stringify(normalized);

		if (this.getAttribute("options") !== serialized) {
			this.setAttribute("options", serialized);
		}

		this._scheduleRender();
	}

	/*
	 * Value
	 */

	get value() {
		return this._value;
	}

	set value(value) {
		this._value = value;

		if (value === undefined || value === null || value === "") {
			if (this.hasAttribute("value")) {
				this.removeAttribute("value");
			}
		} else {
			const serialized = String(value);

			if (this.getAttribute("value") !== serialized) {
				this.setAttribute("value", serialized);
			}
		}

		this._scheduleRender();
	}

	/*
	 * Placeholder
	 */

	get placeholder() {
		return this._placeholder;
	}

	set placeholder(value) {
		this._placeholder = value === undefined || value === null ? "" : String(value);

		this._reflectStringAttribute("placeholder", this._placeholder);

		this._scheduleRender();
	}

	/*
	 * Label
	 */

	get label() {
		return this._label;
	}

	set label(value) {
		this._label = value === undefined || value === null ? "" : String(value);

		this._reflectStringAttribute("label", this._label);

		this._scheduleRender();
	}

	/*
	 * Error
	 */

	get error() {
		return this._error;
	}

	set error(value) {
		this._error = value === undefined || value === null || value === false ? "" : String(value);

		this._reflectStringAttribute("error", this._error);

		this._scheduleRender();
	}

	/*
	 * Disabled
	 */

	get disabled() {
		return this._disabled;
	}

	set disabled(value) {
		this._disabled = this._toBoolean(value);

		this.toggleAttribute("disabled", this._disabled);

		this._scheduleRender();
	}

	/*
	 * Required
	 */

	get required() {
		return this._required;
	}

	set required(value) {
		this._required = this._toBoolean(value);

		this.toggleAttribute("required", this._required);

		this._scheduleRender();
	}

	/*
	 * Rendering
	 */

	_renderStructure() {
		if (this.querySelector(".ps-dropdown")) {
			return;
		}

		this.innerHTML = this.slotEl;
	}

	_cacheElements() {
		this.inputEl = this.querySelector('input[type="search"]');

		this.wrapperEl = this.querySelector(".ps-wrapper");

		this.optionsEl = this.querySelector(".ps-options");

		this.actionBtn = this.querySelector("ps-button");
	}

	_scheduleRender() {
		if (!this.isConnected || this._renderScheduled) {
			return;
		}

		this._renderScheduled = true;

		queueMicrotask(() => {
			this._renderScheduled = false;

			if (this.isConnected) {
				this.render();
			}
		});
	}

	render() {
		this._renderStructure();
		this._cacheElements();

		if (!this.inputEl || !this.wrapperEl || !this.optionsEl || !this.actionBtn) {
			console.warn("PKTSSelect could not find its internal markup.", this);

			return;
		}

		/*
		 * Control state
		 */
		this.inputEl.disabled = this.disabled;
		this.inputEl.required = this.required;

		this.actionBtn.disabled = this.disabled;
		this.actionBtn.toggleAttribute("disabled", this.disabled);

		this.inputEl.setAttribute("aria-required", String(this.required));

		this.inputEl.setAttribute("aria-invalid", String(Boolean(this.error)));

		this.wrapperEl.classList.toggle("error", Boolean(this.error));

		this.wrapperEl.classList.toggle("disabled", this.disabled);

		/*
		 * Selected value
		 */
		const selectedOption = this._getSelectedOption();

		if (selectedOption) {
			this.inputEl.value = selectedOption.title;

			this.actionBtn.id = "deselect-btn";

			this.actionBtn.setAttribute("righticon", "x");

			this.actionBtn.setAttribute("aria-label", "Clear selection");
		} else {
			this.inputEl.value = "";

			this.inputEl.placeholder =
				this.placeholder || (this.label ? `Select ${this.label}` : "Select an option");

			this.actionBtn.id = "down-btn";

			this.actionBtn.setAttribute("righticon", "chevron-down");

			this.actionBtn.setAttribute("aria-label", "Open options");
		}

		this._renderOptions();
		this._updateAriaExpanded(this.isOpen);

		/*
		 * Do not fail rendering if Lucide is not loaded globally.
		 */
		globalThis.lucide?.createIcons?.();
	}

	_renderOptions() {
		if (!this.optionsEl) {
			return;
		}

		this.optionsEl.replaceChildren();

		if (this.options.length === 0) {
			const item = document.createElement("li");

			item.className = "no-options";
			item.textContent = "No options available";

			item.setAttribute("role", "option");
			item.setAttribute("aria-disabled", "true");

			item.style.opacity = "0.5";
			item.style.cursor = "not-allowed";
			item.style.pointerEvents = "none";

			this.optionsEl.append(item);
			return;
		}

		this.options.forEach((option, index) => {
			const item = document.createElement("li");

			const selected = this._valuesEqual(option.const, this.value);

			/*
			 * Use the option index rather than data-value so boolean,
			 * numeric and object values keep their original types.
			 */
			item.dataset.optionIndex = String(index);

			item.textContent = option.title;
			item.tabIndex = -1;

			item.setAttribute("role", "option");
			item.setAttribute("aria-selected", String(selected));

			if (option.disabled) {
				item.setAttribute("aria-disabled", "true");

				item.classList.add("disabled");
			}

			if (selected) {
				item.classList.add("active");
			}

			this.optionsEl.append(item);
		});
	}

	/*
	 * Event listeners
	 */

	_attachEventListeners() {
		if (this._listenersAttached) {
			return;
		}

		this.addEventListener("keydown", this._handleKeydownBound);

		this.inputEl?.addEventListener("input", this._handleInputBound);

		this.inputEl?.addEventListener("click", this._handleInputClickBound);

		this.actionBtn?.addEventListener("click", this._handleActionClickBound);

		this.optionsEl?.addEventListener("click", this._handleOptionClickBound);

		document.addEventListener("click", this._handleOutsideClickBound);

		this._listenersAttached = true;
	}

	_detachEventListeners() {
		if (!this._listenersAttached) {
			return;
		}

		this.removeEventListener("keydown", this._handleKeydownBound);

		this.inputEl?.removeEventListener("input", this._handleInputBound);

		this.inputEl?.removeEventListener("click", this._handleInputClickBound);

		this.actionBtn?.removeEventListener("click", this._handleActionClickBound);

		this.optionsEl?.removeEventListener("click", this._handleOptionClickBound);

		document.removeEventListener("click", this._handleOutsideClickBound);

		this._listenersAttached = false;
	}

	/*
	 * Dropdown state
	 */

	get isOpen() {
		return Boolean(this.optionsEl?.classList.contains("open"));
	}

	openDropdown() {
		if (this.disabled || !this.optionsEl) {
			return;
		}

		this.optionsEl.classList.add("open");
		this._updateAriaExpanded(true);
	}

	closeDropdown() {
		if (!this.optionsEl) {
			return;
		}

		this.optionsEl.classList.remove("open");
		this._updateAriaExpanded(false);
	}

	toggleDropdown() {
		if (this.isOpen) {
			this.closeDropdown();
		} else {
			this.openDropdown();
		}
	}

	_updateAriaExpanded(expanded) {
		const stringValue = String(expanded);

		this.wrapperEl?.setAttribute("aria-expanded", stringValue);

		this.inputEl?.setAttribute("aria-expanded", stringValue);
	}

	/*
	 * Event handlers
	 */

	_handleInputClick(event) {
		event.stopPropagation();

		if (!this.disabled) {
			this.openDropdown();
		}
	}

	_handleInput(event) {
		if (this.disabled || !this.optionsEl) {
			return;
		}

		this.openDropdown();

		const filter = String(event.target.value ?? "")
			.trim()
			.toLowerCase();

		for (const item of this.optionsEl.querySelectorAll("li[data-option-index]")) {
			const matches = !filter || item.textContent.toLowerCase().includes(filter);

			item.hidden = !matches;
		}
	}

	_handleActionClick(event) {
		event.preventDefault();
		event.stopPropagation();

		if (this.disabled) {
			return;
		}

		if (this._getSelectedOption()) {
			this.clear();
			return;
		}

		this.toggleDropdown();

		if (this.isOpen) {
			this._getVisibleOptions()[0]?.focus();
		}
	}

	_handleOptionClick(event) {
		const item = event.target.closest("li[data-option-index]");

		if (
			!item ||
			!this.optionsEl?.contains(item) ||
			item.getAttribute("aria-disabled") === "true"
		) {
			return;
		}

		const index = Number(item.dataset.optionIndex);

		const option = this.options[index];

		if (!option) {
			return;
		}

		this._selectOption(option);
	}

	_handleOutsideClick(event) {
		if (!this.contains(event.target)) {
			this.closeDropdown();
		}
	}

	_handleKeydown(event) {
		if (this.disabled) {
			return;
		}

		const items = this._getVisibleOptions();
		const focusedItem = this.optionsEl?.querySelector("li[data-option-index]:focus");

		const currentIndex = focusedItem ? items.indexOf(focusedItem) : -1;

		if (!this.isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault();

			this.openDropdown();

			if (event.key === "ArrowUp") {
				items.at(-1)?.focus();
			} else {
				items[0]?.focus();
			}

			return;
		}

		if (event.key === "Escape") {
			if (this.isOpen) {
				event.preventDefault();
				this.closeDropdown();
				this.inputEl?.focus();
			}

			return;
		}

		if (event.key === "Tab") {
			this.closeDropdown();
			return;
		}

		if (!this.isOpen || items.length === 0) {
			return;
		}

		switch (event.key) {
			case "ArrowDown": {
				event.preventDefault();

				const nextIndex = (currentIndex + 1) % items.length;

				items[nextIndex]?.focus();
				break;
			}

			case "ArrowUp": {
				event.preventDefault();

				const previousIndex = (currentIndex - 1 + items.length) % items.length;

				items[previousIndex]?.focus();
				break;
			}

			case "Home":
				event.preventDefault();
				items[0]?.focus();
				break;

			case "End":
				event.preventDefault();
				items.at(-1)?.focus();
				break;

			case "Enter":
			case " ": {
				if (!focusedItem) {
					return;
				}

				event.preventDefault();
				focusedItem.click();
				break;
			}
		}
	}

	/*
	 * Selection
	 */

	_selectOption(option) {
		if (!option || option.disabled) {
			return;
		}

		this.value = option.const;
		this.closeDropdown();

		this._emitChange(option.const);
	}

	clear() {
		this.value = undefined;
		this.closeDropdown();

		if (this.inputEl) {
			this.inputEl.value = "";
		}

		this._emitChange(undefined);
	}

	_emitChange(value) {
		this.dispatchEvent(
			new CustomEvent("change", {
				bubbles: true,
				composed: true,
				detail: {
					value,
				},
			}),
		);
	}

	/*
	 * Public methods
	 */

	focus(options) {
		this.inputEl?.focus(options);
	}

	checkValidity() {
		return !(this.required && this._isEmpty(this.value));
	}

	reportValidity() {
		const valid = this.checkValidity();

		this.inputEl?.setAttribute("aria-invalid", String(!valid || Boolean(this.error)));

		return valid;
	}

	/*
	 * Helpers
	 */

	_getSelectedOption() {
		return this.options.find((option) => this._valuesEqual(option.const, this.value));
	}

	_getVisibleOptions() {
		if (!this.optionsEl) {
			return [];
		}

		return Array.from(this.optionsEl.querySelectorAll("li[data-option-index]")).filter(
			(item) => !item.hidden && item.getAttribute("aria-disabled") !== "true",
		);
	}

	_normalizeOptions(value) {
		let options = value;

		if (typeof value === "string") {
			if (!value.trim()) {
				return [];
			}

			try {
				options = JSON.parse(value);
			} catch (error) {
				console.warn("PKTSSelect received invalid options JSON:", value, error);

				return [];
			}
		}

		if (!Array.isArray(options)) {
			return [];
		}

		return options.map((option) => {
			if (option !== null && typeof option === "object") {
				const optionValue =
					"const" in option
						? option.const
						: "value" in option
						  ? option.value
						  : option.title;

				const optionTitle = option.title ?? option.label ?? String(optionValue ?? "");

				return {
					...option,
					const: optionValue,
					title: String(optionTitle),
					disabled: Boolean(option.disabled),
				};
			}

			return {
				const: option,
				title: String(option),
				disabled: false,
			};
		});
	}

	parseValue(value) {
		if (value === "true") {
			return true;
		}

		if (value === "false") {
			return false;
		}

		if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
			return Number(value);
		}

		return value;
	}

	_valuesEqual(left, right) {
		if (Object.is(left, right)) {
			return true;
		}

		/*
		 * Attribute reflection converts primitive values to strings.
		 * This allows numeric/boolean schema values to still match.
		 */
		if (
			left !== null &&
			left !== undefined &&
			right !== null &&
			right !== undefined &&
			typeof left !== "object" &&
			typeof right !== "object"
		) {
			return String(left) === String(right);
		}

		return false;
	}

	_isEmpty(value) {
		return value === undefined || value === null || value === "";
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

if (!customElements.get("pkts-select")) {
	customElements.define("pkts-select", PKTSSelect);
}
