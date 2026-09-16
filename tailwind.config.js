/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./adminui/frontend/**/*.html", "./adminui/frontend/**/*.js"],
	darkMode: ["selector", '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				surface1: "var(--surface-1)",
				surface2: "var(--surface-2)",
				"surface-menu": "var(--surface-menu)",
				"active-menu": "var(--menu-active)",
				copy: "var(--copy)",
				"copy-alt": "var(--copy-alt)",
				shadow: "var(--shadow)",
				primary: "var(--primary)",
				secondary: "var(--secondary)",
				accent: "var(--accent)",
				success: "var(--success)",
				error: "var(--error)",
			},
			fontFamily: {
				// display: ["Signika", "sans-serif"],
				// sans: ["Source Sans 3", "sans-serif"],
				// mono: ["Source Code Pro", "monospace"],
				display: ["Hanuman", "serif"],
				sans: ["Inter", "sans-serif"],
			},
		},
	},
	plugins: [],
};
