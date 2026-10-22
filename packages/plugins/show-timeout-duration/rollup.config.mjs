import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { hermesExpressionEntrypoint } from '@unbound-plugins/rollup-path-aliases';
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
	output: {
		dir: 'dist',
		entryFileNames: 'index.js',
		format: 'es',
		compact: true,
		exports: 'named',
		globals,
	},
	external: Object.keys(globals),
	plugins: [
		nodeResolve(),
		json(),
		swc({ tsconfig: false }),
		iife(),
		hermesExpressionEntrypoint(),
		manifestToDist(),
	],
};
