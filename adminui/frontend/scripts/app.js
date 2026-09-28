// import '@esnet/packets-ui-web';
import "https://esm.sh/@esnet/packets-ui-web@2.0.2?bundle";

// API base URL for the mock backend. Update this once the real API is available.
window.ADMINUI_API_BASE = window.ADMINUI_API_BASE || "http://localhost:8000/api";

// Tell htmx not to use its history cache at all
// So, back/forward always triggers a real reload rather than a snapshot restore.

// if (window.htmx) {
//   window.htmx.config.historyCacheSize = 0;
//   window.htmx.config.refreshOnHistoryMiss = true;
// }

// Maps clean URLs (what shows in the address bar, pushed via hx-push-url) to
// the actual page fragment htmx fetches.
const ROUTES = {
	"/": "/pages/home.html",
	"/define-table": "/pages/clickhouse-table.html",
	"/metadata-manager": "/pages/manage-metadata.html",
	"/define-pipeline": "/pages/define-pipelines.html",
	"/tables": "/pages/tables.html",
	"/pipelines": "/pages/pipelines.html",
};

document.addEventListener("htmx:afterSwap", () => {
	if (window.lucide) {
		window.lucide.createIcons();
	}
	highlightActiveNavLink();
	updateThemeToggleLabel();
});

document.addEventListener("DOMContentLoaded", () => {
	if (window.lucide) {
		window.lucide.createIcons();
	}
	checkSession();
	const mainContent = document.getElementById("main-content");
	const fragment = ROUTES[window.location.pathname] || ROUTES["/"];
	mainContent.setAttribute("hx-get", fragment);
	mainContent.setAttribute("hx-trigger", "load");
	mainContent.setAttribute("hx-swap", "innerHTML");
	window.htmx.process(mainContent);
});

function highlightActiveNavLink() {
	const currentPath = window.location.pathname;
	document.querySelectorAll("[data-nav-link]").forEach((link) => {
		const isActive = link.getAttribute("href") === currentPath;
		link.classList.toggle("nav-link-active", isActive);
		const dot = link.querySelector("[data-nav-dot]");
		if (dot) {
			dot.classList.toggle("hidden", !isActive);
		}
	});
}

// Event-delegated so the toggle works as soon as nav_left.html is swapped in
// via HTMX, without needing to re-bind a listener after every swap.
document.addEventListener("click", (event) => {
	if (!event.target.closest("#theme-toggle")) {
		return;
	}
	const html = document.documentElement;
	const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
	html.setAttribute("data-theme", nextTheme);
	html.classList.toggle("dark", nextTheme === "dark");
	html.classList.toggle("light", nextTheme === "light");
	localStorage.setItem("theme", nextTheme);
	updateThemeToggleLabel();
});

// The toggle's icon/tooltip describe the action a click will take, not the
// current state -- e.g. in dark mode it shows a sun and says "Switch to
// Light Mode". Re-run after every theme change and after nav_left.html
// loads (its markup ships with light-mode text as a static fallback).
function updateThemeToggleLabel() {
	const button = document.getElementById("theme-toggle");
	if (!button) {
		return;
	}
	const isDark = document.documentElement.getAttribute("data-theme") === "dark";
	const label = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
	button.setAttribute("title", label);
	button.setAttribute("aria-label", label);
}

// Session check against the mock API's /auth routes (issue #8). With no users
// configured on the API, /auth/me answers for a developer and nothing changes.
// The test server also gates every request in nginx, so this is belt and
// braces there and the only check when running locally with auth enabled.
async function checkSession() {
	let response;
	try {
		response = await fetch(`${window.ADMINUI_API_BASE}/auth/me`, { credentials: "include" });
	} catch {
		return; // API not running; leave the app usable
	}
	if (response.status === 401) {
		const next = window.location.pathname + window.location.search;
		window.location.replace(`/login?next=${encodeURIComponent(next)}`);
		return;
	}
	if (!response.ok) {
		return;
	}
	const user = await response.json();
	window.ADMINUI_USER = user;
	applyUserToNav();
}

// nav_left.html is swapped in by htmx; run after every swap and after login.
function applyUserToNav() {
	const user = window.ADMINUI_USER;
	if (!user) {
		return;
	}
	const avatar = document.getElementById("user-avatar");
	if (avatar) {
		const initials = user.username
			.split(/[^a-z0-9]+/i)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join("");
		avatar.textContent = initials || "?";
		avatar.parentElement.setAttribute("title", user.username);
	}
	const logout = document.getElementById("logout-button");
	if (logout) {
		logout.style.display = user.enabled ? "" : "none";
	}
}

document.addEventListener("htmx:afterSwap", applyUserToNav);

document.addEventListener("click", async (event) => {
	if (!event.target.closest("#logout-button")) {
		return;
	}
	try {
		await fetch(`${window.ADMINUI_API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
	} finally {
		window.location.replace("/login");
	}
});
