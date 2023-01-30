#!/usr/bin/env -S yarn pnpify ts-node -T --esm

import { $, argv, chalk, echo, fs, which } from "zx";

const skipLocal = argv["ci"];

const VSCODE_PATH = "./.vscode";
const VSCODE_SETTINGS_TEMPLATE = `${VSCODE_PATH}/settings-template.json`;
const VSCODE_SETTINGS = `${VSCODE_PATH}/settings.json`;

echo(`prepare.ts: Preparing workspace`);

async function prepareVSCode() {
	if (skipLocal) return;

	if (!fs.existsSync(VSCODE_SETTINGS)) {
		echo(
			`prepare.ts: ${chalk.blue("Copying VS Code template settings")} into ${VSCODE_SETTINGS}... `,
		);

		await fs.copyFile(VSCODE_SETTINGS_TEMPLATE, VSCODE_SETTINGS);
	} else {
		echo(
			`prepare.ts: ${chalk.blue(
				"VS Code workspace settings found",
			)} - skipped overwriting them (see ${VSCODE_SETTINGS_TEMPLATE})`,
		);
	}
}

async function prepareCommitHooks() {
	try {
		await which("poetry");
	} catch {
		echo(
			`prepare.ts: ${chalk.red(
				"Failed",
			)} - you must install poetry - see https://python-poetry.org/docs/#installation for a guide`,
		);

		process.exit(1);
	}

	echo(`prepare.ts: Installing commit hooks`);

	await $`poetry install --no-interaction`;

	if (!skipLocal) await $`poetry run pre-commit install -t commit-msg -t pre-commit`;
}

await prepareVSCode();
await prepareCommitHooks();
