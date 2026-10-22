import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { bunPathAliases, hermesExpressionEntrypoint } from '@unbound-plugins/rollup-path-aliases';
import iife from 'rollup-plugin-iife';
import { swc } from 'rollup-plugin-swc3';

const pluginRoot = fileURLToPath(new URL('.', import.meta.url));
const globals = {
	'@unbound-app/api': 'window.unbound',
	react: 'window.React',
	'react-native': 'window.ReactNative',
};

function manifestToDist() {
	return {
		name: 'manifest-to-dist',
		buildStart() {
			const manifest = JSON.parse(readFileSync(resolve(pluginRoot, 'manifest.json'), 'utf8'));
			manifest.main = manifest.main.replace(/\.(tsx|ts|jsx|mjs)$/, '.js');
			this.emitFile({
				type: 'asset',
				fileName: 'manifest.json',
				source: `${JSON.stringify(manifest, null, '\t')}\n`,
			});
		},
	};
}

export default {
	input: 'src/index.tsx',
	external: Object.keys(globals),
	plugins: [
		bunPathAliases(),
		nodeResolve(),
		json(),
		swc({ tsconfig: false }),
		iife(),
		hermesExpressionEntrypoint({ hasSettingsPanel: true }),
		manifestToDist(),
	],
	output: {
		dir: 'dist',
		entryFileNames: 'index.js',
		format: 'es',
		compact: true,
		exports: 'named',
		globals,
	},
};
