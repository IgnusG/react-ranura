import * as fs from "node:fs";
import * as path from "node:path";
import { cwd } from "node:process";

import { Plugin, ResolvedConfig } from "vite";

import { Entry, PackageJsonExports, PluginOptions } from "./types.js";
import { createReduceEntryOptionsToEntries, getPackageJSONPath } from "./utilities.js";

export type { PluginOptions };

type InputToOutput = Map<string, string>;

interface PackageJsonTypeExports {
	[exportPath: string]: {
		types: string;
	};
}

function createReduceEntriesToPackageExports({
	inputToOutput,
	buildConfig,
}: {
	inputToOutput: InputToOutput;
	buildConfig: ResolvedConfig["build"];
}) {
	function outputToExportPath(output: string) {
		return "./" + path.join(buildConfig.outDir, output);
	}

	return function reduceEntriesToPackageExports(
		result: PackageJsonTypeExports,
		entry: Entry,
	): PackageJsonTypeExports {
		const output = inputToOutput.get(entry.sourcePath);

		if (!output) {
			throw new Error(`Cannot find actual .dts output path for entry source "${entry.sourcePath}"`);
		}

		return {
			...result,

			[entry.exportPath]: {
				types: outputToExportPath(output),
			},
		};
	};
}

function createReduceExistingExportsEntriesToTypedPackageExports({
	entryTypeExports,
}: {
	entryTypeExports: Map<string, { types: string }>;
}) {
	return function reduceExistingExportsEntriesToTypedPackageExports(
		result: PackageJsonExports,
		[entryExportPath, entryExports]: [string, PackageJsonExports[string]],
	): PackageJsonExports {
		const entryTypeExport = entryTypeExports.get(entryExportPath);

		if (!entryTypeExport) {
			throw new Error(
				`Cannot find type definitions for export ${entryExportPath}. Searched exports ${exports.keys()}`,
			);
		}

		return {
			...result,
			[entryExportPath]: {
				...entryTypeExport,
				...entryExports,
			},
		};
	};
}

export default async function dtsPlugin(options: PluginOptions): Promise<Plugin> {
	let entries: Map<string, Entry>;
	let config: ResolvedConfig;

	const inputToOutput: InputToOutput = new Map();

	return {
		name: "vite:dts",
		config(userConfig) {
			entries = new Map(
				Object.entries(
					options.entries.reduce(
						createReduceEntryOptionsToEntries({ config: userConfig, options }),
						{},
					),
				),
			);
		},

		configResolved(userConfig) {
			config = userConfig;
		},

		generateBundle(outputOptions, bundle) {
			if (outputOptions.format !== options.formats[0]) return;

			for (const assetOrChunk of Object.values(bundle)) {
				if (assetOrChunk.type !== "chunk") continue;
				if (!assetOrChunk.facadeModuleId) continue;
				if (!assetOrChunk.isEntry) continue;

				const file = fs.readFileSync(assetOrChunk.facadeModuleId).toString();

				const hasDefaultExport = /^(export default |export \{[^}]+? as default\s*[,}])/m.test(file);

				const relativePath = path.relative(
					path.join(config.root ?? cwd(), assetOrChunk.fileName),
					assetOrChunk.facadeModuleId,
				);

				const relativeJsPath = relativePath.replace(/\.ts(x)?$/, ".js$1");

				const source =
					`export * from "${relativeJsPath}"` +
					(hasDefaultExport ? `\nexport {default} from "${relativeJsPath}"` : ``);

				const output = path.join(
					path.parse(assetOrChunk.fileName).dir,
					`${path.parse(assetOrChunk.fileName).name.replace(/\.(es|cjs)$/, "")}.d.ts`,
				);

				inputToOutput.set(assetOrChunk.facadeModuleId, output);

				this.emitFile({
					type: "asset",
					fileName: output,
					source,
				});
			}
		},

		closeBundle() {
			const packageText = fs.readFileSync(getPackageJSONPath({ config })).toString();
			const packageDetails = JSON.parse(packageText);

			const entryTypeExports = new Map(
				Object.entries(
					Array.from(entries.values()).reduce(
						createReduceEntriesToPackageExports({ inputToOutput, buildConfig: config.build }),
						{},
					),
				),
			);

			if (
				!packageDetails["#exports"] ||
				!packageDetails["#exports"].startsWith("Generated automatically")
			) {
				throw new Error(
					`Couldn't find the auto-generated marker #exports - add the vite-plugin-entries plugin before vite-plugin-dts (it must run after it)`,
				);
			}

			if (!options.silent)
				this.warn("Adding type definitions to the `exports` field in your package.json ✅");

			packageDetails.exports = Array.from(
				Object.entries(packageDetails.exports as PackageJsonExports),
			).reduce(createReduceExistingExportsEntriesToTypedPackageExports({ entryTypeExports }), {});

			fs.writeFileSync(
				getPackageJSONPath({ config }),
				JSON.stringify(packageDetails, undefined, 4) + (packageText.endsWith("\n") ? "\n" : ""),
			);
		},
	};
}
