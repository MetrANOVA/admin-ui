const path = require("path");

module.exports = {
	plugins: {
		"postcss-import": {
			path: [path.resolve(__dirname, "node_modules")],
		},
		tailwindcss: {},
		autoprefixer: {},
	},
};
