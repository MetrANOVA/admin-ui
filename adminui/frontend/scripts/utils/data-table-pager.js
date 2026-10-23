// Client-side paging for data tables: Prev 1 … 5 … 15 Next, using the
// mn-page-tiles styles, same as the other list pages. Paging moves to the API
// later; pages keep calling renderPager() and only swap where the rows come from.

// First, current, last
export function pageNumbers(page, total) {
	return [...new Set([1, page, total])].sort((a, b) => a - b);
}

export function pageCount(rowCount, pageSize) {
	return Math.max(1, Math.ceil(rowCount / pageSize));
}

export function pageSlice(rows, page, pageSize) {
	return rows.slice((page - 1) * pageSize, page * pageSize);
}

function pageButton(label, targetPage, { active = false, disabled = false } = {}) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "mn-page-tile";
	button.dataset.page = targetPage;
	button.textContent = label;
	button.disabled = disabled;
	if (active) button.setAttribute("aria-current", "page");
	return button;
}

// Fills pagerEl with the page buttons and hides the table footer (footEl)
// when everything fits on one page.
export function renderPager(pagerEl, footEl, page, total) {
	// Packets sets display:table-footer-group on tfoot, which outranks hidden
	footEl.style.display = total <= 1 ? "none" : "";
	if (total <= 1) {
		pagerEl.replaceChildren();
		return;
	}

	const parts = [pageButton("Prev", page - 1, { disabled: page === 1 })];
	let previous = 0;
	for (const n of pageNumbers(page, total)) {
		if (n - previous > 1) {
			const gap = document.createElement("span");
			gap.className = "mn-page-gap";
			gap.textContent = "…";
			parts.push(gap);
		}
		parts.push(pageButton(String(n), n, { active: n === page }));
		previous = n;
	}
	parts.push(pageButton("Next", page + 1, { disabled: page === total }));
	pagerEl.replaceChildren(...parts);
}

// Calls onPage(n) when a page button is clicked
export function onPagerClick(pagerEl, onPage) {
	pagerEl.addEventListener("click", (event) => {
		const button = event.target.closest("[data-page]");
		if (!button || button.disabled) return;
		onPage(Number(button.dataset.page));
	});
}
