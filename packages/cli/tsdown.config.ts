import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/rollup/index.ts', 'src/oxlint/plugin.ts'],
	platform: 'node',
	format: 'esm',
	dts: true,
	clean: true,
	deps: {
		neverBundle: ['@unbound-app/debugger-protocol'],
	},
});
