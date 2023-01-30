import path from "node:path";
import { cwd } from "node:process";

import { ResolvedConfig, UserConfig } from "vite";

import { Entry, EntryOptions, PluginOptions } from "./types.js";

export function getPackageJSONPath({ config }: { config: ResolvedConfig | UserConfig }) {
	return path.join(config.root ?? cwd(), "package.json");
}

export function addRelativeDot(path: string) {
	if (path.startsWith("./")) return path;

	return `./${path}`;
}

export function removeRelativeDot(path: string) {
	if (!path.startsWith("./")) return path;

	return path.replace(/^\.\//, "");
}

/** Normalize input entry options and their paths into a standardized format
 *
 * sourcePath: absolute path to the entry's source file
 *
 * - outputPath:
 * 	   - if `entryOptions.outputPath` not provided an extensionless path based on the sourcePath relative to the root directory
 *     - if provided must be a relative extensionless path
 *
 * - exportPath:
 * 	   - if `entryOptions.exports.isMain` is true, "."
 *     - if `entryOptions.exports.exportPath` not provided the `./${outputPath}`
 *     - if provided must be a relative extensionless path
 */
export function createReduceEntryOptionsToEntries({
	config,
	options,
}: {
	config: UserConfig;
	options: PluginOptions;
}) {
	return function reduceEntryOptionsToEntries(
		result: Record<string, Entry>,
		entryOptions: EntryOptions,
		index: number,
	): Record<string, Entry> {
		const sourcePath = path.isAbsolute(entryOptions.sourcePath)
			? entryOptions.sourcePath
			: path.join(config.root ?? cwd(), entryOptions.sourcePath);

		const sourcePathChunks = path.parse(sourcePath);

		const outputPath =
			entryOptions.outputPath ??
			path.join(
				path.relative(
					path.join(config.root ?? cwd(), options.sourceRoot ?? ""),
					sourcePathChunks.dir,
				),
				sourcePathChunks.name,
			);

		const exportPath = entryOptions.exports?.exportPath ?? outputPath;

		const entry: Entry = {
			sourcePath,
			outputPath: removeRelativeDot(outputPath),
			exportPath: entryOptions.exports?.isMain ? "." : addRelativeDot(exportPath),
		};

		return {
			...result,
			[index.toString()]: entry,
		};
	};
}
