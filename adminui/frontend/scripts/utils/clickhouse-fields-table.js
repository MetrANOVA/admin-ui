// Paged table of a Clickhouse table's fields: name, type, and Nullable /
// Primary Key as True/False chips. Used by the Create table confirm dialog
// and the table detail page.
import {
	onPagerClick,
	pageCount,
	pageSlice,
	renderPager,
} from "/scripts/utils/data-table-pager.js";

function textCell(value) {
	const td = document.createElement("td");
	td.className = "mono";
	td.textContent = value ?? "";
	td.title = value ?? "";
	return td;
}

function chipCell(value, style) {
	const td = document.createElement("td");
	const chip = document.createElement("span");
	chip.className = `table-chip table-chip--${style}`;
	chip.textContent = value ? "True" : "False";
	td.append(chip);
	return td;
}

// fields: [{ field_name, field_type, nullable, primary_key }]
// nameLabel / typeLabel: column headings, which differ between the mockups
export function createFieldsTable(
	fields,
	{ pageSize = 6, nameLabel = "Field Name", typeLabel = "Field Type", className = "" } = {},
) {
	const columns = [
		{ label: nameLabel, cell: (row) => textCell(row.field_name) },
		{ label: typeLabel, cell: (row) => textCell(row.field_type) },
		{ label: "Nullable", cell: (row) => chipCell(row.nullable, "outline") },
		{ label: "Primary Key", cell: (row) => chipCell(row.primary_key, "filled") },
	];
	const total = pageCount(fields.length, pageSize);
	let page = 1;

	const wrap = document.createElement("div");
	wrap.className = `fields-table ${className}`.trim();
	wrap.innerHTML = `
		<table class="pkts-data-table mn-data-table w-full">
			<thead><tr></tr></thead>
			<tbody></tbody>
			<tfoot><tr><td colspan="${columns.length}">
				<div class="mn-page-tiles"></div>
			</td></tr></tfoot>
		</table>
	`;

	const headRow = wrap.querySelector("thead tr");
	columns.forEach(({ label }) => {
		const th = document.createElement("th");
		th.innerHTML = `<span class="labelWrapper"></span>`;
		th.firstChild.textContent = label;
		headRow.append(th);
	});

	const body = wrap.querySelector("tbody");
	const foot = wrap.querySelector("tfoot");
	const pager = wrap.querySelector(".mn-page-tiles");

	function render() {
		body.replaceChildren(
			...pageSlice(fields, page, pageSize).map((row) => {
				const tr = document.createElement("tr");
				tr.append(...columns.map(({ cell }) => cell(row)));
				return tr;
			}),
		);
		renderPager(pager, foot, page, total);
	}

	onPagerClick(pager, (n) => {
		page = n;
		render();
	});

	render();
	return wrap;
}
