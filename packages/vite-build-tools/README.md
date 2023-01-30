# `@ignsg/vite-build-tools`

Install using your favorite package manager, eg. `yarn add @ignsg/vite-build-tools`.

## `@ignsg/vite-build-tools/vite-plugin-entries`

This plugin is meant to simplify management of multi-entry libraries. You provide a build configuration as the input to the plugin inside of your `vite.config.ts` and it will take care of building all of your entry points and then creating the appropriate `exports` inside your package.json.

### Example

```typescript
// vite.config.ts

import entriesPlugin, {
    PluginOptions as ViteBuildPluginOptions,
} from "@ignsg/vite-build-tools/vite-plugin-entries";

const buildConfig: ViteBuildPluginOptions = {
    formats: ["es"],
    entries: [
        {
            sourcePath: "./src/index.ts",
            outputPath: "lib/output",
            exports: {
                isMain: true,
            },
        },
        {
            sourcePath: "./src/folder/index.ts",
            outputPath: "lib/otherOutput",
            exports: {
                exportPath: "./awesome",
            },
        },
    ],
};

export default {
    plugins: [entriesPlugin(buildConfig)],
};
```

Will generate the folder structure:

```
- dist
  |- lib
    |- output-[hash].es.js
    |- otherOutput-[hash].es.js
```

And modify the package.json like so:

```json
{
    ...,
    "#exports": "Generated automatically ..."
    "exports": {
        ".": {
            "import": "./dist/lib/output-[hash].es.js",
            "default": "./dist/lib/output-[hash].es.js",
        },
        "./awesome": {
            "import": "./dist/lib/otherOutput-[hash].es.js",
            "default": "./dist/lib/otherOutput-[hash].es.js",
        }
    }
    ...,
}
```

To learn about other configuration options check out [src/types.ts](https://github.com/IgnusG/build-tools/tree/main/packages/vite-build-tools/src/types.ts)

## `@ignsg/vite-build-tools/vite-plugin-dts`

This plugin goes hand-in-hand with `@ignsg/vite-build-tools/vite-plugin-entries` to augment the generated output with lightweight type definitions (uncompiled - referencing the source). It also adds these paths to the type definitions to the `exports` field in your package.json.

### Example

```typescript
import entriesPlugin, { PluginOptions as ViteBuildPluginOptions } from "@ignsg/vite-build-tools/vite-plugin-entries";
import dtsPlugin from "@ignsg/vite-build-tools/vite-plugin-dts";

const buildConfig: ViteBuildPluginOptions = ...;

export default {
    plugins: [entriesPlugin(buildConfig), dtsPlugin(buildConfig)],
}
```

Will generate the following structure (amended from above):

```
- dist
  |- lib
    |- ...
    |- output-[hash].d.ts
```

And modify the package.json like so:

```json
{
    ...
    "exports": {
        ".": {
            "types": "./dist/lib/output-[hash].d.ts",
            ...
        },
        "./awesome": {
            "types": "./dist/lib/otherOutput-[hash].d.ts",
            ...
        }
    }
    ...,
}
```

> Of course this library is using itself for the build configuration. Take a look at [vite.config.ts](https://github.com/IgnusG/build-tools/tree/main/packages/vite-build-tools/vite.config.ts) to check out how it works. Enjoy 🎉
