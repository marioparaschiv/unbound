import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/controller.ts', 'src/pending-requests.ts', 'src/registry.ts'],
	platform: 'node',
	format: 'esm',
	dts: true,
	clean: true,
	deps: {
		// Imported for types only; inlining its declarations would drag in the React Native typings.
		neverBundle: ['@unbound-app/types'],
	},
});
