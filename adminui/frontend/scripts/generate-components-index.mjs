import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);

/*
 * generate-components-index.mjs is in frontend/scripts.
 * The components directory is frontend/components.
 */
const dirPath = path.resolve(scriptDir, "../components");
const outputFile = path.join(dirPath, "index.js");

fs.readdir(dirPath, (err, files) => {
	if (err) {
		console.error(
			`Error reading directory "${dirPath}":`,
			err,
		);
		process.exitCode = 1;
		return;
	}

	const componentFiles = files
		.filter(
			(file) =>
				(file.startsWith("pkts-") || file.startsWith("ps-")) &&
				file.endsWith(".js"),
		)
		.sort();

	if (componentFiles.length === 0) {
		console.log(
			`No pkts-*.js files found in "${dirPath}"`,
		);
		return;
	}

	/*
	 * index.js is written into the same directory as the component
	 * files, so use relative imports.
	 */
	const importStatements = componentFiles
		.map((file) => `import "./${file}";`)
		.join("\n");

	const componentNames = componentFiles
		.map((file) => `\t"${file.slice(0, -3)}"`)
		.join(",\n");

	const content = `/* AUTO-GENERATED — DO NOT EDIT */
${importStatements}

export const componentNames = [
${componentNames}
];

export default componentNames;
`;

	fs.writeFile(outputFile, content, (writeError) => {
		if (writeError) {
			console.error(
				`Error writing "${outputFile}":`,
				writeError,
			);
			process.exitCode = 1;
			return;
		}

		console.log(
			`Generated ${outputFile} for ${componentFiles.length} components.`,
		);
	});
});