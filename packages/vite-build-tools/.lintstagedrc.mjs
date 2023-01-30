import baseConfig from "@workspace/root/.lintstagedrc.mjs";

export default {
	...baseConfig,
	"**/*.ts": [...(baseConfig["**/*.ts"] ?? []), "yarn test:related", "yarn build:package.json"],
};
