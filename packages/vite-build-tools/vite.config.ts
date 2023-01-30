/// <reference types="vitest" />

import { defineConfig } from "vite";

import dtsPlugin from "./src/vite-plugin-dts.js";
import entriesPlugin, { PluginOptions } from "./src/vite-plugin-entries.js";

const buildConfig: PluginOptions = {
	formats: ["es"],
	sourceRoot: "./src",
	entries: [
		{
			sourcePath: "./src/vite-plugin-entries.ts",
		},
		{
			sourcePath: "./src/vite-plugin-dts.ts",
		},
	],
};

export default defineConfig(async (env) => {
	return {
		plugins: [
			env.mode !== "test" && entriesPlugin(buildConfig),
			env.mode !== "test" && dtsPlugin(buildConfig),
		],
		build: {
			target: ["node18"],
			sourcemap: true,
			minify: false,
			rollupOptions: {
				external: [/node:.*/],
			},
		},
		test: {
			threads: false,
			watchExclude: ["end-2-end/fixtures"],
		},
	};
});
