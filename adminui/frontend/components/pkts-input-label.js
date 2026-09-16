import { attr } from "./pkts-utils.js";

export class PKTSInputLabel extends HTMLElement {
	static get observedAttributes() {
		return ["label", "desc"];
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
            <label>
                ${this.label}
                ${
					this.desc
						? `<pkts-tooltip desc="${this.desc.replace(
								/"/g,
								"&quot;",
						  )}"> </pkts-tooltip>`
						: ""
				}
            </label>`;
	}
}

Object.defineProperties(PKTSInputLabel.prototype, {
	label: attr("label"),
	desc: attr("desc"),
});

customElements.define("pkts-input-label", PKTSInputLabel);
