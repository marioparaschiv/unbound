import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: [
		'src/index.ts',
		'src/rollup/index.ts',
		'src/oxlint/plugin.ts',
		'src/settings/schema.ts',
	],
	platform: 'node',
	format: 'esm',
	// The root config lets tsgo emit the private workspace packages' types the cli inlines.
	dts: { tsconfig: '../../tsconfig.cli-dts.json' },
	clean: true,
	deps: {
		neverBundle: ['@unbound-app/debugger-protocol'],
	},
});
