import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/controller.ts', 'src/registry.ts'],
	platform: 'node',
	format: 'esm',
	dts: true,
	clean: true,
});
