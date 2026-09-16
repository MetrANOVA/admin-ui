import componentNames from "/components/index.js";

import * as Packets from "https://esm.sh/@esnet/packets-ui-web@2.0.2?bundle";

function classNameToTagName(className) {
	return className
		.replace(/^Pkts/, "pkts")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase();
}

const packetsInputComponentNames = Object.keys(Packets)
	.filter((exportName) => /^PktsInput[A-Z]/.test(exportName))
	.map(classNameToTagName)
	.filter((tagName) => {
		const registered = Boolean(customElements.get(tagName));

		if (!registered) {
			console.warn(`Packets export exists but custom element is not registered: ${tagName}`);
		}

		return registered;
	});

const allComponentNames = [...new Set([...componentNames, ...packetsInputComponentNames])];

console.log("Packets input components:", allComponentNames);
/* CREATE TESTER AND RENDERERS */

function createCustomTester(componentName) {
	return function (uischema, schema, context) {
		if (!uischema.scope) return -1;
		if (uischema.customComponent === componentName) return 6;
		return -1;
	};
}
function createCustomRenderer(componentName) {
	return function (data, handleChange, schemaPath, schema) {
		const jsonSchema = schema?.schema ?? {};
		const uiSchema = schema?.uischema ?? {};
		const uiOptions = uiSchema.options ?? {};

		/*
		 * Required state
		 */
		const conditionallyRequired =
			schema?.rootSchema?.allOf?.some((item) => item?.then?.required?.includes(schemaPath)) ??
			false;

		const required = Boolean(schema?.required || conditionallyRequired);

		/*
		 * Current/default value
		 */
		const value = data !== undefined && data !== null ? data : jsonSchema.default;

		/*
		 * Label
		 */
		const fallbackLabel = schemaPath
			? schemaPath
					.split(".")
					.at(-1)
					.replace(/[-_]/g, " ")
					.replace(/\b\w/g, (character) => character.toUpperCase())
			: "";

		const label = schema?.label ?? uiSchema.label ?? jsonSchema.title ?? fallbackLabel;

		/*
		 * Error
		 */
		const errors = schema?.errors;
		const hasErrors = Array.isArray(errors) ? errors.length > 0 : Boolean(errors);

		let error = "";

		if (hasErrors && jsonSchema["x-invalid-message"]) {
			error = String(jsonSchema["x-invalid-message"]).replace("%s", value ?? "");
		} else if (hasErrors) {
			error = errors;
		}

		/*
		 * Props sent to the inner pkts-* component.
		 *
		 * Label, description, required and error are handled by
		 * pkts-form-control, so they are not included here.
		 */
		const controlProps = {
			id: uiSchema.scope ?? schemaPath,
			path: schemaPath,
		};

		/*
		 * Numeric constraints
		 */
		if (jsonSchema.minimum != null) {
			controlProps.min = jsonSchema.minimum;
		} else if (jsonSchema.exclusiveMinimum != null) {
			controlProps.min = jsonSchema.exclusiveMinimum;
		}

		if (jsonSchema.maximum != null) {
			controlProps.max = jsonSchema.maximum;
		} else if (jsonSchema.exclusiveMaximum != null) {
			controlProps.max = jsonSchema.exclusiveMaximum;
		}

		if (jsonSchema.multipleOf != null) {
			controlProps.step = jsonSchema.multipleOf;
		} else if (
			controlProps.min != null &&
			controlProps.max != null &&
			controlProps.max > controlProps.min
		) {
			const range = controlProps.max - controlProps.min;

			controlProps.step = Math.pow(10, Math.floor(Math.log10(range)) - 1);
		}

		/*
		 * Select/radio/checkbox options.
		 *
		 * Keep JSON.stringify if Packets expects its options property
		 * to contain a JSON string.
		 */
		if (jsonSchema.oneOf) {
			controlProps.options = JSON.stringify(jsonSchema.oneOf);
		} else if (jsonSchema.enum) {
			controlProps.options = JSON.stringify(jsonSchema.enum);
		} else if (jsonSchema.items?.oneOf) {
			controlProps.options = JSON.stringify(jsonSchema.items.oneOf);
		} else if (jsonSchema.items?.enum) {
			controlProps.options = JSON.stringify(jsonSchema.items.enum);
		}

		/*
		 * Optional UI-schema properties that should be sent directly
		 * to the Packets component.
		 */
		if (uiOptions.placeholder != null) {
			controlProps.placeholder = uiOptions.placeholder;
		}

		if (uiOptions.minLength != null) {
			controlProps.minLength = uiOptions.minLength;
		} else if (jsonSchema.minLength != null) {
			controlProps.minLength = jsonSchema.minLength;
		}

		if (uiOptions.maxLength != null) {
			controlProps.maxLength = uiOptions.maxLength;
		} else if (jsonSchema.maxLength != null) {
			controlProps.maxLength = jsonSchema.maxLength;
		}

		if (jsonSchema.pattern != null) {
			controlProps.pattern = jsonSchema.pattern;
		}

		if (uiOptions.rows != null) {
			controlProps.rows = uiOptions.rows;
		}

		if (uiOptions.autocomplete != null) {
			controlProps.autocomplete = uiOptions.autocomplete;
		}

		/*
		 * Allow additional component props from the UI schema:
		 *
		 * options: {
		 *   componentProps: {
		 *     appearance: "compact"
		 *   }
		 * }
		 */
		if (uiOptions.componentProps && typeof uiOptions.componentProps === "object") {
			Object.assign(controlProps, uiOptions.componentProps);
		}

		/*
		 * Return the wrapper. It will create the installed Packets
		 * component identified by componentName.
		 */
		return {
			tag: "pkts-form-control",

			props: {
				componentName,

				id: uiSchema.scope ?? schemaPath,
				name: schemaPath,

				value,
				label,
				description: jsonSchema.description ?? "",
				examples: jsonSchema.examples ?? undefined,

				required,
				error,

				// Supports readonly configured in the schema.
				disabled: Boolean(schema?.disabled || uiOptions.readonly || jsonSchema.readOnly),

				/*
				 * Change this through the UI schema if a component
				 * emits "input", "valueChange", etc.
				 */
				eventName: uiOptions.changeEvent ?? "change",

				controlProps,

				/*
				 * pkts-form-control emits a normalized change event:
				 *
				 * event.detail.value
				 */
				onChange: (event) => {
					const nextValue = event.detail?.value ?? event.target?.value;

					handleChange(schemaPath, nextValue);
				},
			},
		};
	};
}

/* REGISTER RENDERERS */
document.body.addEventListener("json-form:beforeMount", (event) => {
	console.log("does anyone call you");
	let elem = event.detail[0].target;
	console.log("elem: ", elem);
	if (!elem) return;

	allComponentNames.forEach((component) => {
		let renderer = {
			tester: createCustomTester(component),
			renderer: createCustomRenderer(component),
		};
		elem.appendRenderer(renderer);
	});

	elem.appendRenderer({
		tester: createCustomTester("pkts-input-text"),
		renderer: createCustomRenderer("pkts-input-text"),
	});
});

/* READONLY MODE */

document.body.addEventListener("json-form:mounted", (event) => {
	const readonly = event.target.readonly == "true";
	componentNames.forEach((component) => {
		document
			.querySelector("json-form")
			?.querySelectorAll(component)
			.forEach((comp) => {
				comp.disabled = readonly;
			});
	});
});

document.body.addEventListener("json-form:updated", (event) => {
	const readonly = event.target.readonly == "true";
	componentNames.forEach((component) => {
		document
			.querySelector("json-form")
			?.querySelectorAll(component)
			.forEach((comp) => {
				comp.disabled = readonly;
			});
	});
});

/* Mark Dirty */

document.addEventListener("markAllDirty", () => {
	document.querySelectorAll(componentNames).forEach((control) => {
		if (typeof control.markDirty === "function") {
			control.markDirty();
			control.connectedCallback();
		}
	});

	newMessageBanner("Form fields not all valid", "Error", true);
});

function observeButton(button) {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.attributeName === "disabled") {
				console.log(`Button is now: ${button.disabled ? "disabled" : "enabled"}`);
				console.trace(); // This prints the full call stack
			}
		});
	});

	observer.observe(button, {
		attributes: true,
		attributeFilter: ["disabled"],
	});
}

function startObserving(container) {
	const containerObserver = new MutationObserver(() => {
		document.querySelectorAll(".array-list-item-delete").forEach((button) => {
			if (!button.dataset.observed) {
				button.dataset.observed = "true";
				observeButton(button);
			}
		});
	});

	containerObserver.observe(container, {
		childList: true,
		subtree: true,
	});
}

// Wait for the form to appear in the DOM
const domObserver = new MutationObserver(() => {
	const form = document.querySelector("form");
	if (form) {
		domObserver.disconnect(); // Stop watching once form is found
		startObserving(form);
	}
});

// Watch the body for the form to be mounted
domObserver.observe(document.body, {
	childList: true,
	subtree: true,
});
