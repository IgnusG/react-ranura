import * as fs from "node:fs";
import * as path from "node:path";

import { BuildOptions, LibraryFormats, Plugin, ResolvedConfig } from "vite";

import { Entry, PackageJsonExports, PluginOptions } from "./types.js";
import { createReduceEntryOptionsToEntries, getPackageJSONPath } from "./utilities.js";

export type { PluginOptions };

type InputOptions = { [entryAlias: string]: string };

type RollupOutputOptions = Exclude<BuildOptions["rollupOptions"], undefined>["output"];
type RollupSingleOutputOptions = Exclude<RollupOutputOptions, unknown[] | undefined>;

type InputToOutput = Map<string, Partial<Record<LibraryFormats, string>>>;

function reduceEntryMapToInput(result: InputOptions, [id, entry]: [string, Entry]): InputOptions {
	return {
		...result,

		[id]: entry.sourcePath,
	};
}

function createReduceEntriesToPackageExports({
	config,
	options,
	inputToOutput,
}: {
	config: ResolvedConfig;
	options: PluginOptions;
	inputToOutput: InputToOutput;
}) {
	function outputToExportPath(output: string | undefined, entry: Entry) {
		if (!output) {
			throw new Error(`Cannot find actual output path for entry source "${entry.sourcePath}"`);
		}

		return "./" + path.join(config.build.outDir, output);
	}

	return function reduceEntriesToPackageExports(
		result: PackageJsonExports,
		entry: Entry,
	): PackageJsonExports {
		const esmExport = options.formats.includes("es")
			? outputToExportPath(inputToOutput.get(entry.sourcePath)?.es, entry)
			: undefined;

		const cjsExport = options.formats.includes("cjs")
			? outputToExportPath(inputToOutput.get(entry.sourcePath)?.cjs, entry)
			: undefined;

		return {
			...result,

			[entry.exportPath]: {
				...(esmExport ? { import: esmExport } : undefined),
				...(cjsExport ? { require: cjsExport } : undefined),

				...(options.formats[0] === "es"
					? { default: esmExport }
					: options.formats[0] === "cjs"
					? { default: cjsExport }
					: undefined),
			},
		};
	};
}

function createMapFormatToOutputOptions({
	isEsModule,
	outputConfig,
	entries,
}: {
	isEsModule: boolean;
	outputConfig: RollupOutputOptions;
	entries: Map<string, Entry>;
}) {
	return function mapFormatToOutputOptions(format: LibraryFormats): RollupSingleOutputOptions {
		return {
			...outputConfig,
			format,
			interop: isEsModule && format === "cjs" ? "compat" : "default",

			entryFileNames: (chunkInfo) => {
				const entry = entries.get(chunkInfo.name);

				if (!entry) {
					throw new Error(
						`Cannot find entry for chunk ${chunkInfo.name}. Searched chunks: ${entries.keys()}`,
					);
				}

				const outputFilename = `${entry.outputPath}-[hash].[format].js`;

				if (format === "cjs") return `cjs/${outputFilename}`;
				else return `${outputFilename}`;
			},
		};
	};
}

function verifyBuildOptions(opts: PluginOptions) {
	opts.entries.forEach((entry) => {
		if (entry.outputPath && path.isAbsolute(entry.outputPath)) {
			throw new Error(
				`entry.outputPath "${entry.outputPath}" cannot be absolute - use build.outDir to specify the output directory instead`,
			);
		}

		if (entry.exports?.exportPath) {
			if (path.isAbsolute(entry.exports.exportPath)) {
				throw new Error(
					`entry.exports.exportPath "${entry.exports.exportPath}" cannot be absolute - it's used inside of package.json's exports field (consult the documentation at https://nodejs.org/api/packages.html#conditional-exports)`,
				);
			}

			if (entry.exports.exportPath === ".") {
				throw new Error(
					`entry.exports.exportPath "${entry.exports.exportPath}" cannot be "." - set entry.exports.isMain to true instead`,
				);
			}
		}
	});
}

function createPackageJsonModuleFields({
	options,
	exports,
}: {
	options: PluginOptions;
	exports: PackageJsonExports;
}) {
	return {
		module: options.formats.includes("es") ? exports["."]?.import : undefined,
		main: options.formats.includes("cjs") ? exports["."]?.require : undefined,

		"#exports": "Generated automatically by @ignsg/vite-build-tools",
		exports,
	};
}

export default async function entriesPlugin(options: PluginOptions): Promise<Plugin> {
	let config: ResolvedConfig;
	let entries: Map<string, Entry>;

	verifyBuildOptions(options);

	const inputToOutput: InputToOutput = new Map();

	return {
		name: "vite:entries",
		config(userConfig) {
			const packageDetails = JSON.parse(
				fs.readFileSync(getPackageJSONPath({ config: userConfig })).toString(),
			);

			const isEsModule = packageDetails.type === "module";

			userConfig.build ??= {};

			entries = new Map(
				Object.entries(
					options.entries.reduce(
						createReduceEntryOptionsToEntries({ config: userConfig, options }),
						{},
					),
				),
			);

			userConfig.build.rollupOptions = {
				...userConfig.build.rollupOptions,
				preserveEntrySignatures: "strict",
				input: Array.from(entries.entries()).reduce(reduceEntryMapToInput, {}),

				output: options.formats.map(
					createMapFormatToOutputOptions({
						isEsModule,
						outputConfig: userConfig.build.rollupOptions?.output,
						entries,
					}),
				),
			};
		},

		configResolved(userConfig) {
			config = userConfig;
		},

		generateBundle(outputOptions, bundle) {
			for (const assetOrChunk of Object.values(bundle)) {
				if (assetOrChunk.type !== "chunk") continue;
				if (!assetOrChunk.facadeModuleId) continue;
				if (!assetOrChunk.isEntry) continue;

				// Gather the mapping from source file paths (facadeModuleId) to the generated output files (fileName)
				inputToOutput.set(assetOrChunk.facadeModuleId, {
					...inputToOutput.get(assetOrChunk.facadeModuleId),
					[outputOptions.format]: assetOrChunk.fileName,
				});
			}

			if (outputOptions.format === "cjs") {
				this.emitFile({
					type: "asset",
					fileName: `cjs/package.json`,
					source: JSON.stringify(
						{
							"#type":
								"Force these files being recognized as commonjs without .cjs (which some tools don't support)",
							type: "commonjs",
						},
						undefined,
						4,
					),
				});
			}
		},

		closeBundle() {
			const generatedKeys = ["#exports", "exports", "main", "module"];

			const injectionPoints = options.packageJsonInjectionPoints ?? [
				"exports",
				"dependencies",
				"devDependencies",
			];

			const packageText = fs.readFileSync(getPackageJSONPath({ config })).toString();

			const packageDetails = JSON.parse(packageText);

			// Protect against overwriting existing user package.json configuration
			if (
				!packageDetails["#exports"] ||
				!packageDetails["#exports"].startsWith("Generated automatically")
			) {
				const conflictingKeys = generatedKeys.filter(
					(generatedKey) => generatedKey in packageDetails,
				);

				if (conflictingKeys.length > 0) {
					const serializedConflictingKeys = conflictingKeys
						.map((conflict) => `"${conflict}"`)
						.join(", ");

					throw new Error(
						`Detected that the keys: ${serializedConflictingKeys} already exist in the package.json but the auto-generated marker "#exports" does not. Aborting in order not to overwrite these keys - add an "#exports": "Generated automatically" anywhere in your package.json to confirm these keys can be overwritten`,
					);
				}
			}

			if (!options.silent)
				this.warn(
					"Adding an `exports` field to your package.json based on your build configuration ✅",
				);

			const exports = Array.from(entries.values()).reduce(
				createReduceEntriesToPackageExports({ config, options, inputToOutput }),
				{},
			);

			let exportsGenerated = false;

			let adjustedPackageJson = Object.entries(packageDetails).reduce((result, [key, value]) => {
				const exportsInjection = injectionPoints.includes(key)
					? createPackageJsonModuleFields({ options, exports })
					: undefined;

				if (exportsInjection) exportsGenerated = true;

				return {
					...result,
					...exportsInjection,
					...(generatedKeys.includes(key) ? {} : { [key]: value }),
				};
			}, {} as Record<string, unknown>);

			if (!exportsGenerated) {
				// No injection point was found, attach the exports to the end instead
				adjustedPackageJson = {
					...adjustedPackageJson,
					...createPackageJsonModuleFields({ options, exports }),
				};
			}

			fs.writeFileSync(
				getPackageJSONPath({ config }),
				JSON.stringify(adjustedPackageJson, undefined, 4) +
					(packageText.endsWith("\n") ? "\n" : ""),
			);
		},
	};
}
