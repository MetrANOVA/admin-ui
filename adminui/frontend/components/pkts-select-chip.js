import { PKTSSelect } from "./pkts-select.js";

export class PKTSSelectChip extends PKTSSelect {
	render() {
		super.render();
		const optionsMap = new Map(this.options.map((opt) => [opt.const, opt.title]));

		if (this.disabled && this.value) {
			const tagHTML = `<span class="pkts-tag">
                ${optionsMap.get(this.value) || "Option Not Found"}
            </span>`;
			const tagDiv = `<div class="pkts-tags">${tagHTML}</div>`;
			this.querySelector(".form-container").insertAdjacentHTML("beforeend", tagDiv);
		}
	}
}

customElements.define("pkts-select-chip", PKTSSelectChip);
