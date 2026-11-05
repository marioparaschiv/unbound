import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/manifest.ts'],
	platform: 'node',
	format: 'esm',
	dts: true,
	clean: true,
});
