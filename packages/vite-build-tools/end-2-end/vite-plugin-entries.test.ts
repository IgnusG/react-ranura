import fs from "node:fs";
import path from "node:path";

import { build, InlineConfig } from "vite";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import entriesPlugin, { PluginOptions } from "../src/vite-plugin-entries.js";
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
			entries: [{ sourcePath: "index.ts" }],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/index-06b5571c.es.js")).toMatchSnapshot();

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				exports: {
					"./index": {
						import: "./dist/index-06b5571c.es.js",
						default: "./dist/index-06b5571c.es.js",
					},
				},
			}),
		);
	});

	test("correctly creates the output build files for a es/cjs mixed configuration", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es", "cjs"],
			entries: [{ sourcePath: path.join(__dirname, "fixtures/index.ts") }],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/index-06b5571c.es.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/cjs/index-6fade66e.cjs.js")).toMatchSnapshot();

		expect(JSON.parse(readFile("fixtures/dist/cjs/package.json"))).toEqual(
			expect.objectContaining({
				type: "commonjs",
			}),
		);

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				exports: {
					"./index": {
						import: "./dist/index-06b5571c.es.js",
						require: "./dist/cjs/index-6fade66e.cjs.js",
						default: "./dist/index-06b5571c.es.js",
					},
				},
			}),
		);
	});

	test("correctly creates the output build files for a es/cjs mixed configuration for multiple entries", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es", "cjs"],
			entries: [
				{ sourcePath: path.join(__dirname, "fixtures/index.ts") },
				{ sourcePath: path.join(__dirname, "fixtures/other.ts") },
			],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/index-06b5571c.es.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/other-ca5d566e.es.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/cjs/index-6fade66e.cjs.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/cjs/other-8548cf46.cjs.js")).toMatchSnapshot();

		expect(JSON.parse(readFile("fixtures/dist/cjs/package.json"))).toEqual(
			expect.objectContaining({
				type: "commonjs",
			}),
		);

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				exports: {
					"./index": {
						import: "./dist/index-06b5571c.es.js",
						require: "./dist/cjs/index-6fade66e.cjs.js",
						default: "./dist/index-06b5571c.es.js",
					},
					"./other": {
						import: "./dist/other-ca5d566e.es.js",
						require: "./dist/cjs/other-8548cf46.cjs.js",
						default: "./dist/other-ca5d566e.es.js",
					},
				},
			}),
		);
	});

	test("creates main & module references for main exports", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es", "cjs"],
			entries: [
				{ sourcePath: path.join(__dirname, "fixtures/index.ts"), exports: { isMain: true } },
				{ sourcePath: path.join(__dirname, "fixtures/other.ts") },
			],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				module: "./dist/index-06b5571c.es.js",
				main: "./dist/cjs/index-6fade66e.cjs.js",
			}),
		);
	});

	test("supports modifying output and exports paths", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es", "cjs"],
			entries: [
				{
					sourcePath: path.join(__dirname, "fixtures/index.ts"),
					outputPath: "nestedFolder/helloWorld",
				},
				{
					sourcePath: path.join(__dirname, "fixtures/other.ts"),
					exports: { exportPath: "virtualFolder/bestGreeting" },
				},
			],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/nestedFolder/helloWorld-06b5571c.es.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/cjs/nestedFolder/helloWorld-6fade66e.cjs.js")).toMatchSnapshot();

		expect(JSON.parse(readFile("fixtures/package.json"))).toEqual(
			expect.objectContaining({
				exports: {
					"./nestedFolder/helloWorld": {
						import: "./dist/nestedFolder/helloWorld-06b5571c.es.js",
						require: "./dist/cjs/nestedFolder/helloWorld-6fade66e.cjs.js",
						default: "./dist/nestedFolder/helloWorld-06b5571c.es.js",
					},
					"./virtualFolder/bestGreeting": {
						import: "./dist/other-ca5d566e.es.js",
						require: "./dist/cjs/other-8548cf46.cjs.js",
						default: "./dist/other-ca5d566e.es.js",
					},
				},
			}),
		);
	});

	test("supports nesting folders outputting the same filename", async () => {
		const buildConfig: PluginOptions = {
			formats: ["es", "cjs"],
			entries: [
				{
					sourcePath: path.join(__dirname, "fixtures/index.ts"),
					exports: { exportPath: "main" },
				},
				{
					sourcePath: path.join(__dirname, "fixtures/nested/index.ts"),
					exports: { exportPath: "nested" },
				},
			],
		};

		await build({
			...structuredClone(defaultBuidConfig),
			plugins: [entriesPlugin(buildConfig)],
		});

		expect(readFile("fixtures/dist/index-06b5571c.es.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/nested/index-c03f850b.es.js")).toMatchSnapshot();

		expect(readFile("fixtures/dist/cjs/index-6fade66e.cjs.js")).toMatchSnapshot();
		expect(readFile("fixtures/dist/cjs/nested/index-8dadecae.cjs.js")).toMatchSnapshot();
	});

	test.each(["main", "module", "exports"])(
		'fails if the existing package.json already contains the key %s that would be overwritten but #exports: "Generated automatically" is not found',
		async (key) => {
			const buildConfig: PluginOptions = {
				formats: ["es"],
				entries: [
					{
						sourcePath: path.join(__dirname, "fixtures/index.ts"),
					},
				],
			};

			fs.writeFileSync(
				path.join(__dirname, "fixtures/package.json"),
				JSON.stringify({ name: "fixtures", [key]: true }, undefined, 2),
			);

			await expect(async () => {
				await build({
					...structuredClone(defaultBuidConfig),
					plugins: [entriesPlugin(buildConfig)],
				});
			}).rejects.toThrowError(
				`Detected that the keys: "${key}" already exist in the package.json but the auto-generated marker "#exports" does not. Aborting in order not to overwrite these keys - add an "#exports": "Generated automatically" anywhere in your package.json to confirm these keys can be overwritten`,
			);
		},
	);
});
