import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { swc } from 'rollup-plugin-swc3';

const pluginRoot = fileURLToPath(new URL('.', import.meta.url));

function hermesExpressionEntrypoint() {
	return {
		name: 'hermes-expression-entrypoint',
		generateBundle(_outputOptions, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue;
				let code = chunk.code.trim();
				code = code.replace(/^var\s+[A-Za-z_$][\w$]*\s*=\s*/, '');
				code = code.replace(/;\s*$/, '');
				chunk.code = `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${code};return this.__plugin;},start(){const plugin=this.__load();if(plugin&&typeof plugin.start==='function')return plugin.start();},stop(){const plugin=this.__load();if(plugin&&typeof plugin.stop==='function')return plugin.stop();}})`;
			}
		},
	};
}

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

const globals = {
	'@unbound-app/api': 'window.unbound',
	react: 'window.React',
	'react-native': 'window.ReactNative',
};

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
