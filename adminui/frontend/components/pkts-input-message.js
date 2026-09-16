import { attr, boolAttr } from "./pkts-utils.js";

export class PKTSInputMessage extends HTMLElement {
	static get observedAttributes() {
		return ["required", "error"];
	}

	constructor() {
		super();
	}

	connectedCallback() {
		this.render();
	}

	attributeChangedCallback(name, oldVal, newVal) {
		if (oldVal !== newVal) this.render();
	}

	render() {
		this.innerHTML = `
            <div class='error ${this.error ? "show" : ""}'>${this.error}</div>
            <div class="required">${this.required ? "Required" : ""}</div>
    `;
	}
}

Object.defineProperties(PKTSInputMessage.prototype, {
	error: attr("error"),
	required: boolAttr("required"),
});

customElements.define("pkts-input-message", PKTSInputMessage);
