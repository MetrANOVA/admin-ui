/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./adminui/frontend/**/*.html", "./adminui/frontend/**/*.js"],
	darkMode: ["selector", '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				primary: "var(--primary)",
				secondary: "var(--secondary)",
				tertiary: "var(--tertiary)",

				background: "var(--background)",
				surface1: "var(--surface-1)",
				surface2: "var(--surface-2)",

				copy: "var(--copy)",
				"copy-alt": "var(--copy-alt)",
				"copy-alt-2": "var(--copy-alt-2)",
				shadow: "var(--shadow)",

				success: "var(--success)",
				error: "var(--error)",
				accent: "var(--accent)",

				"surface-menu": "var(--surface-menu)",
				"active-menu": "var(--menu-active)",
			},
			fontFamily: {
				display: ["Hanuman", "serif"],
				sans: ["Inter", "sans-serif"],
			},
		},
	},
	plugins: [],
};
