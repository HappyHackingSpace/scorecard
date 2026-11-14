import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		clean: true,
		sourcemap: true,
	},
	{
		entry: ["src/cli-run.ts"],
		format: ["esm"],
		sourcemap: true,
		banner: { js: "#!/usr/bin/env node" },
	},
]);
