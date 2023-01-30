import path from "node:path";

import { build, InlineConfig } from "vite";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import dtsPlugin from "../src/vite-plugin-dts.js";
import { PluginOptions } from "../src/vite-plugin-dts.js";
import entriesPlugin from "../src/vite-plugin-entries.js";
import { __dirname, cleanup, readFile } from "./utilities.js";

const defaultBuidConfig: InlineConfig = {
	root: path.join(__dirname, "fixtures"),
	build: {
		target: ["node18"],
		minify: false,
	},
};

describe("vite-plugin-entries", () => {
	beforeEach(() => {
		cleanup();
	});

	afterAll(() => {
		cleanup();
	});

	test("correctly creates the output build files for a simple es configuration", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es"],
			entries: [{ sourcePath: path.join(__dirname, "fixtures/index.ts") }],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig), dtsPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/index-06b5571c.d.ts")).toMatchSnapshot();

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				exports: {
					"./index": expect.objectContaining({
						types: "./dist/index-06b5571c.d.ts",
					}),
				},
			}),
		);
	});
});
