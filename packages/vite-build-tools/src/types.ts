import { LibraryFormats } from "vite";

type EntryOptionsDotExports =
	| {
			/** If true will mark this entry as the main entry - it can be imported using just you library's package name */
			isMain: boolean;
			exportPath?: never;
	  }
	| {
			isMain?: never;
			/** Relative path (with or without `./` prefix) that will be used as the path inside package.json's exports field and will be available for import by your library's users.
			 *
			 * For example given the default `outDir: "./dist"` and an `outputPath: "./file" would generate:
			 * ```json
			 * {
			 *   "exports": {
			 *     "./file": {
			 *       "import": "./dist/file.js",
			 *       ...
			 *     }
			 *   }
			 * }
			 * ```
			 */
			exportPath: string;
	  };

export interface EntryOptions {
	/** The path to the source code of the entry */
	sourcePath: string;
	/** Relative path ending with the name of the output (without an extension) that will be generated inside of the directory specified by `outDir`.
	 *
	 * **Default: `sourcePath`**
	 *
	 * For example, given the default `outDir: "./dist"`:
	 * - An `outputPath: "./file"` would generate `./dist/file.js`
	 * - An `outputPath: "./folder/file"` would generate `./dist/folder/file.js`
	 */
	outputPath?: string;
	/** Contains either `{ isMain: true }` or `{ exportPath: "..." }`
	 *
	 * **Default: `{ exportPath: outputPath }`**
	 *
	 * @see {@linkcode EntryOptionsDotExports.exportPath}
	 */
	exports?: EntryOptionsDotExports;
}

export interface PluginOptions {
	/** If true supresses the log messages about updating the user's package.json.
	 *
	 * **Default: `false`** */
	silent?: boolean;
	/** Array of package.json keys before which the plugin should place the generated entries. First match will be used.
	 *
	 * **Default: `["export", "dependencies", "devDependencies"]`**
	 *
	 * For example to generate "exports" before "scripts" you can specify ["scripts"] and the plugin will adjust the package.json to be:
	 * ```json
	 * {
	 *   ...,
	 *   "exports": ...,
	 *   "scripts": ...,
	 *   ...,
	 * }
	 * ```
	 */
	packageJsonInjectionPoints?: string[];
	/** If provided and an entry in `entries` does not contain an explicit `outputPath` will strip this prefix when generating the output files in your output folder.
	 *
	 * For example if you have your source files in `src` and your `outDir` set to `./dist` an entry such as:
	 * ```json
	 * {
	 *   sourcePath: "./src/index.ts"
	 * }
	 * ```
	 * would generate its output as `./dist/src/index.es.js`. With `sourceRoot: "./src"` it will instead generate an output as `./dist/index.es.js`.
	 */
	sourceRoot?: string;
	/** List of formats you want to have generated */
	formats: LibraryFormats[];
	/** List of {@linkcode EntryOptions}'s that should be used an entry points - each represents a file/export that can be consumed by your library's user */
	entries: EntryOptions[];
}

/** @private */
export interface PackageJsonExports {
	[exportPath: string]: {
		import?: string;
		require?: string;
		types?: string;
	};
}

/** @private */
export interface Entry {
	sourcePath: string;
	outputPath: string;
	exportPath: string;
}
