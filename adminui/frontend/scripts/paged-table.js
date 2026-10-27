// Server-paged table: fetches one page at a time from a list endpoint that
// takes limit / offset / q / sort / order and reports the total in an
// X-Total-Count header (the shape proposed in MetrANOVA/api#42).
//
// The page size is either a fixed number or "auto": as many rows as fit the
// height of the scroll area, re-measured when it resizes. Auto rounds down to
// a multiple of five, so a page holds 5, 10, 15… rows rather than 6 or 11.
// Changing the size keeps the first visible row on screen rather than jumping
// to page 1.

const PAGE_SIZES = [10, 25, 50];
const SIZE_KEY = "adminui.pageSize";
const ROW_STEP = 5;
const MIN_ROWS = ROW_STEP;
const MAX_ROWS = 100;
const DEFAULT_ROW_HEIGHT = 37;

function storedSize() {
	const raw = localStorage.getItem(SIZE_KEY);
	return PAGE_SIZES.includes(Number(raw)) ? Number(raw) : "auto";
}

export class PagedTable {
	/**
	 * @param {object} options
	 * @param {string} options.url            list endpoint, without query string
	 * @param {HTMLTableElement} options.tableEl
	 * @param {HTMLElement} options.bodyEl    tbody the rows go into
	 * @param {HTMLElement} options.pagerEl   container inside the tfoot cell
	 * @param {(items: object[]) => string} options.renderRows
	 * @param {() => number} options.columnCount
	 * @param {HTMLInputElement} [options.searchEl]
	 * @param {string} [options.emptyText]
	 * @param {(table: PagedTable) => void} [options.onRender]
	 * @param {number} [options.reserve]      extra pixels to leave free below the table
	 */
	constructor(options) {
		Object.assign(this, { emptyText: "Nothing to show.", onRender: () => {} }, options);
		this.scrollEl = document.getElementById("main-content");
		this.size = storedSize();
		this.limit = this.size === "auto" ? this.fit() : this.size;
		this.offset = 0;
		this.total = 0;
		this.items = [];
		this.query = "";
		this.sort = null;
		this.order = "asc";
		this.rowHeight = DEFAULT_ROW_HEIGHT;
		this.request = 0;
		this.settling = 0;
		this.reserve = options.reserve || 0;
		// Draw the pager before measuring, so the footer already has its height.
		this.renderPager();
		this.limit = this.size === "auto" ? this.fit() : this.size;

		this.pagerEl.addEventListener("click", (event) => {
			const tile = event.target.closest("[data-offset]");
			if (!tile || tile.disabled) return;
			this.offset = Number(tile.dataset.offset);
			this.load();
		});
		this.pagerEl.addEventListener("change", (event) => {
			if (!event.target.matches("[data-page-size]")) return;
			this.setSize(event.target.value === "auto" ? "auto" : Number(event.target.value));
		});
		this.tableEl.querySelector("thead").addEventListener("click", (event) => {
			const button = event.target.closest("[data-sort]");
			if (!button) return;
			const column = button.dataset.sort;
			this.order = this.sort === column && this.order === "asc" ? "desc" : "asc";
			this.sort = column;
			this.offset = 0;
			this.load();
		});
		if (this.searchEl) {
			let timer;
			this.searchEl.addEventListener("input", () => {
				clearTimeout(timer);
				timer = setTimeout(() => {
					this.query = this.searchEl.value.trim();
					this.offset = 0;
					this.load();
				}, 250);
			});
		}

		// Follow the scroll area's height, but only while this table is on the page.
		let resizeTimer;
		this.observer = new ResizeObserver(() => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => this.refit(), 150);
		});
		if (this.scrollEl) this.observer.observe(this.scrollEl);
	}

	/** Rows that fit between the top of the body and the bottom of the scroll area. */
	fit() {
		if (!this.scrollEl || !this.tableEl.isConnected) return PAGE_SIZES[0];
		const scroll = this.scrollEl.getBoundingClientRect();
		const bodyTop = this.bodyEl.getBoundingClientRect().top - scroll.top + this.scrollEl.scrollTop;
		const foot = this.tableEl.querySelector("tfoot");
		const footHeight = foot ? foot.getBoundingClientRect().height : 0;
		// Whatever follows the table (card padding, buttons, page padding) stays visible too.
		const section = this.tableEl.closest("section") || this.tableEl.parentElement;
		const trailing = section.getBoundingClientRect().bottom - this.tableEl.getBoundingClientRect().bottom;
		const room = this.scrollEl.clientHeight - bodyTop - footHeight - trailing - this.reserve;
		const rows = Math.floor(room / (this.rowHeight || DEFAULT_ROW_HEIGHT));
		const rounded = Math.floor(rows / ROW_STEP) * ROW_STEP;
		return Math.max(MIN_ROWS, Math.min(MAX_ROWS, rounded));
	}

	/** Re-measure in auto mode; call after anything changes the layout around the table. */
	refit() {
		if (!this.tableEl.isConnected) {
			this.observer.disconnect();
			return;
		}
		if (this.size !== "auto") return;
		const limit = this.fit();
		if (limit !== this.limit) this.setLimit(limit);
	}

	setSize(size) {
		this.size = size;
		if (size === "auto") localStorage.removeItem(SIZE_KEY);
		else localStorage.setItem(SIZE_KEY, String(size));
		this.setLimit(size === "auto" ? this.fit() : size);
	}

	setLimit(limit) {
		// Keep the row that is first on screen on the page we land on.
		this.offset = Math.floor(this.offset / limit) * limit;
		this.limit = limit;
		return this.load();
	}

	async load() {
		const request = ++this.request;
		const params = new URLSearchParams({ limit: this.limit, offset: this.offset });
		if (this.query) params.set("q", this.query);
		if (this.sort) {
			params.set("sort", this.sort);
			params.set("order", this.order);
		}
		this.tableEl.setAttribute("aria-busy", "true");
		let response;
		try {
			response = await fetch(`${this.url}?${params}`, { credentials: "include" });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			this.items = await response.json();
		} catch (error) {
			if (request !== this.request) return;
			this.items = [];
			this.total = 0;
			this.message(`Could not load the data (${error.message}).`);
			this.renderPager();
			return;
		} finally {
			if (request === this.request) this.tableEl.removeAttribute("aria-busy");
		}
		if (request !== this.request) return; // a newer request has gone out since

		const header = response.headers.get("X-Total-Count");
		// Without the header the best we can say is "at least one more page" when this one is full.
		this.total =
			header !== null
				? Number(header)
				: this.offset + this.items.length + (this.items.length === this.limit ? 1 : 0);

		// Past the end (rows were removed, or the search narrowed): step back to the last page.
		if (!this.items.length && this.total > 0 && this.offset > 0) {
			this.offset = Math.floor((this.total - 1) / this.limit) * this.limit;
			return this.load();
		}

		this.render();

		// Only now are the real row and footer heights known; in auto mode that can
		// change how many rows fit. Capped, so a layout that never settles cannot loop.
		const firstRow = this.bodyEl.querySelector("tr:not([aria-hidden])");
		const height = firstRow ? firstRow.getBoundingClientRect().height : 0;
		if (height) this.rowHeight = height;
		if (this.size === "auto" && this.settling < 2) {
			const limit = this.fit();
			if (limit !== this.limit) {
				this.settling += 1;
				return this.setLimit(limit);
			}
		}
		this.settling = 0;
	}

	message(text) {
		this.bodyEl.innerHTML = `<tr><td colspan="${this.columnCount()}" class="text-center text-copy-alt">${text}</td></tr>`;
	}

	render() {
		if (!this.items.length) {
			this.message(this.emptyText);
		} else {
			this.bodyEl.innerHTML = this.renderRows(this.items) + this.fillerRows();
		}
		this.renderPager();
		this.renderSortIcons();
		// Rows arrive after htmx scanned the page, so their hx-* attributes need processing.
		if (window.htmx) window.htmx.process(this.bodyEl);
		if (window.lucide) window.lucide.createIcons();
		this.onRender(this);
	}

	// A short last page is padded to a full one, so the table keeps its height on every page.
	fillerRows() {
		if (this.total <= this.limit || this.items.length >= this.limit) return "";
		const row = `<tr aria-hidden="true" class="pointer-events-none">${"<td>&nbsp;</td>".repeat(this.columnCount())}</tr>`;
		return row.repeat(this.limit - this.items.length);
	}

	renderPager() {
		const pages = Math.max(1, Math.ceil(this.total / this.limit));
		const current = Math.floor(this.offset / this.limit) + 1;
		const tile = (label, page, { active = false, disabled = false } = {}) =>
			`<button type="button" class="mn-page-tile" data-offset="${(page - 1) * this.limit}"${
				active ? ' aria-current="page"' : ""
			}${disabled ? " disabled" : ""}>${label}</button>`;

		const parts = [tile("Prev", current - 1, { disabled: current === 1 })];
		const shown = [...new Set([1, current - 1, current, current + 1, pages])]
			.filter((page) => page >= 1 && page <= pages)
			.sort((a, b) => a - b);
		let previous = 0;
		for (const page of shown) {
			if (page - previous > 1) parts.push(`<span class="mn-page-gap">…</span>`);
			parts.push(tile(String(page), page, { active: page === current }));
			previous = page;
		}
		parts.push(tile("Next", current + 1, { disabled: current === pages }));

		const option = (value, label) =>
			`<option value="${value}"${String(this.size) === String(value) ? " selected" : ""}>${label}</option>`;
		const autoLabel = this.size === "auto" ? `Auto (${this.limit})` : "Auto";

		this.pagerEl.innerHTML = `
			<div class="mn-page-tiles">${parts.join("")}</div>
			<label class="mn-page-size">
				<span>Rows</span>
				<select data-page-size aria-label="Rows per page">
					${option("auto", autoLabel)}${PAGE_SIZES.map((size) => option(size, size)).join("")}
				</select>
			</label>
		`;
	}

	renderSortIcons() {
		for (const button of this.tableEl.querySelectorAll("thead [data-sort]")) {
			const active = button.dataset.sort === this.sort;
			const icon = !active ? "chevrons-up-down" : this.order === "asc" ? "arrow-up" : "arrow-down";
			const label = button.dataset.label || button.dataset.sort;
			button.innerHTML = `<i data-lucide="${icon}" class="h-4 w-4"></i>`;
			button.setAttribute(
				"aria-label",
				!active ? `Sort by ${label}` : `Sorted by ${label}, ${this.order === "asc" ? "ascending" : "descending"}`,
			);
		}
	}
}

// 2026-08-11 15:21:14 → 08/11/26, the short date the mockups use.
export function shortDate(value) {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
	return match ? `${match[2]}/${match[3]}/${match[1].slice(2)}` : "—";
}

export function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
