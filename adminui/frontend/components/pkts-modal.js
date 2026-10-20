const THEMES = {
	Success: { color: "var(--success)", icon: "check-circle", variant: "primary" },
	Error: { color: "var(--error)", icon: "alert-circle", variant: "destructive" },
	Warning: { color: "var(--warning)", icon: "alert-triangle", variant: "primary" },
	default: { color: "var(--copy)", icon: "alert-circle", variant: "primary" },
};

const FOCUSABLE =
	'pkts-button, a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Escapes values interpolated into the button markup
const esc = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

let modalCount = 0;

function focusEl(el) {
	const target = el.shadowRoot ? el : el.querySelector?.("button, a[href]") ?? el;
	target.focus?.();
}

export class PKTSModal extends HTMLElement {
	static observedAttributes = [
		"question",
		"message",
		"theme",
		"icon",
		"link",
		"confirm-label",
		"cancel-label",
	];

	constructor() {
		super();
		this._resolve = null;
		this._previousFocus = null;
		this._overrides = {};
		this._built = false;
		this._titleId = `pkts-modal-title-${++modalCount}`;

		this._onKeydown = (event) => {
			if (!this.isOpen) return;

			if (event.key === "Escape") {
				event.preventDefault();
				this._close(false);
				return;
			}

			if (event.key !== "Tab") return;

			const all = [...this._content.querySelectorAll(FOCUSABLE)];
			const focusable = all.filter(
				(el) => !all.some((other) => other !== el && other.contains(el)),
			);
			if (!focusable.length) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;
			const inside = (el) => el === active || el.contains(active);

			if (event.shiftKey && inside(first)) {
				event.preventDefault();
				focusEl(last);
			} else if (!event.shiftKey && inside(last)) {
				event.preventDefault();
				focusEl(first);
			}
		};
	}

	get isOpen() {
		return this.style.display === "block";
	}

	connectedCallback() {
		if (!this._built) this._build();
		this._render();
		if (!this.isOpen) this.style.display = "none";
		document.addEventListener("keydown", this._onKeydown);
	}

	disconnectedCallback() {
		document.removeEventListener("keydown", this._onKeydown);
	}

	attributeChangedCallback() {
		if (this._built && this.isOpen) this._render();
	}

	/**
	 * Resolves true on confirm, false on cancel / close / Escape / underlay click.
	 *
	 * options: question, highlight (substring of question shown in monospace),
	 *          message, theme, icon, link, confirmLabel, cancelLabel,
	 *          confirmIcon, cancelIcon, confirmVariant, body (Node)
	 */
	open(options = {}) {
		if (this.isOpen) this._close(false);

		this._overrides = options;
		this._previousFocus = document.activeElement;

		this._body.replaceChildren(...[options.body].filter(Boolean));
		this._render();
		this.style.display = "block";

		requestAnimationFrame(() => focusEl(this._actions.lastElementChild));

		return new Promise((resolve) => {
			this._resolve = resolve;
		});
	}

	close() {
		this._close(false);
	}

	_close(confirmed) {
		if (!this.isOpen) return;

		this.style.display = "none";

		const resolve = this._resolve;
		this._resolve = null;

		this._previousFocus?.focus?.();
		this._previousFocus = null;

		this.dispatchEvent(
			new CustomEvent(confirmed ? "confirm-yes-clicked" : "modal-cancel", { bubbles: true }),
		);
		resolve?.(confirmed);
	}

	_settings() {
		const attr = (name) => this.getAttribute(name) ?? undefined;

		return {
			question: attr("question") ?? "",
			message: attr("message") ?? "",
			theme: attr("theme"),
			icon: attr("icon"),
			link: attr("link"),
			confirmLabel: attr("confirm-label") ?? "Confirm",
			cancelLabel: attr("cancel-label") ?? "Cancel",
			cancelIcon: "x",
			...this._overrides,
		};
	}

	_build() {
		this.innerHTML = `
			<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="${this._titleId}">
				<div class="modal-underlay"></div>
				<div class="modal-content">
					<button type="button" class="modal-close" aria-label="Close">
						<pkts-icon name="x" size="16"></pkts-icon>
					</button>
					<div class="modal-header">
						<pkts-icon class="modal-icon" size="20" aria-hidden="true"></pkts-icon>
						<h4 class="modal-question" id="${this._titleId}"></h4>
					</div>
					<p class="modal-message" hidden></p>
					<div class="modal-body"></div>
					<div class="form-actions save-cancel"></div>
				</div>
			</div>
		`;

		this._content = this.querySelector(".modal-content");
		this._icon = this.querySelector(".modal-icon");
		this._question = this.querySelector(".modal-question");
		this._message = this.querySelector(".modal-message");
		this._body = this.querySelector(".modal-body");
		this._actions = this.querySelector(".form-actions");

		this.querySelector(".modal-underlay").addEventListener("click", () => this._close(false));
		this.querySelector(".modal-close").addEventListener("click", () => this._close(false));

		// One delegated listener covers both buttons, even after _render() replaces them
		this._actions.addEventListener("click", (event) => {
			if (event.target.closest(".modal-confirm")) this._close(true);
			else if (event.target.closest(".modal-cancel")) this._close(false);
		});

		this._built = true;
	}

	// Plain text with one optional highlighted substring (no HTML injection)
	_setQuestion(text, highlight) {
		const index = highlight ? text.indexOf(highlight) : -1;

		if (index === -1) {
			this._question.textContent = text;
			return;
		}

		const code = document.createElement("code");
		code.textContent = highlight;

		this._question.replaceChildren(
			text.slice(0, index),
			code,
			text.slice(index + highlight.length),
		);
	}

	_render() {
		const settings = this._settings();
		const theme = THEMES[settings.theme] ?? THEMES.default;

		this._content.style.borderColor = theme.color;

		this._icon.setAttribute("name", settings.icon ?? theme.icon);
		this._icon.style.color = theme.color;

		this._setQuestion(settings.question, settings.highlight);
		this._message.textContent = settings.message;
		this._message.hidden = !settings.message;

		const confirmVariant = settings.confirmVariant ?? theme.variant;

		this._actions.innerHTML = `
			<pkts-button
				class="modal-cancel form-actions--cancel"
				type="button"
				variant="secondary"
				${settings.cancelIcon ? "" : `label="${esc(settings.cancelLabel)}"`}
			>${
				settings.cancelIcon
					? `<pkts-icon name="${esc(settings.cancelIcon)}" size="20"></pkts-icon>${esc(
							settings.cancelLabel,
					  )}`
					: ""
			}</pkts-button>

			<pkts-button
				class="modal-confirm form-actions--save"
				variant="${esc(confirmVariant)}"
				${settings.link ? `as="a" href="${esc(settings.link)}"` : `type="button"`}
				${settings.confirmIcon ? "" : `label="${esc(settings.confirmLabel)}"`}
			>${
				settings.confirmIcon
					? `<pkts-icon name="${esc(settings.confirmIcon)}" size="20"></pkts-icon>${esc(
							settings.confirmLabel,
					  )}`
					: ""
			}</pkts-button>
		`;
	}
}

customElements.define("pkts-modal", PKTSModal);

export function confirmDialog(options = {}) {
	let modal = document.querySelector("pkts-modal[data-shared]");

	if (!modal) {
		modal = document.createElement("pkts-modal");
		modal.dataset.shared = "";
		document.body.append(modal);
	}

	return modal.open(options);
}
