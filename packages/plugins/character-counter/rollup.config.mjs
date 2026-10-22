import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { swc } from 'rollup-plugin-swc3';
import { bunPathAliases } from '@unbound-plugins/rollup-path-aliases';

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

function hermesExpressionEntrypoint() {
	return {
		name: 'hermes-expression-entrypoint',
		generateBundle(_outputOptions, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') continue;
				let code = chunk.code.trim();
				code = code.replace(/^var\s+[A-Za-z_$][\w$]*\s*=\s*/, '');
				code = code.replace(/;\s*$/, '');
				chunk.code = `({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=${code};return this.__plugin;},start(){const plugin=this.__load()?.default??this.__load();if(plugin&&typeof plugin.start==='function')return plugin.start();},stop(){const plugin=this.__load()?.default??this.__load();if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(){const plugin=this.__load()?.default??this.__load();return plugin&&typeof plugin.getSettingsPanel==='function'?plugin.getSettingsPanel():null;}})`;
			}
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
		hermesExpressionEntrypoint(),
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
