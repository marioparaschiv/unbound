import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { swc } from 'rollup-plugin-swc3';
import { bunPathAliases, hermesExpressionEntrypoint } from '@unbound-plugins/rollup-path-aliases';

const pluginRoot = fileURLToPath(new URL('.', import.meta.url));

function resolveModule(source) {
	const candidate = resolve(pluginRoot, 'src', source.replace(/^@show-me-your-name\//, ''));
	const search = [
		candidate,
		`${candidate}.ts`,
		`${candidate}.tsx`,
		`${candidate}.js`,
		`${candidate}.mjs`,
		`${candidate}.json`,
		resolve(candidate, 'index.ts'),
		resolve(candidate, 'index.tsx'),
		resolve(candidate, 'index.js'),
	];

	for (const file of search) {
		if (existsSync(file)) return file;
	}

	return null;
}

function pluginAlias() {
	return {
		name: 'show-me-your-name-alias',
		resolveId(source) {
			if (!source.startsWith('@show-me-your-name/')) return null;
			return resolveModule(source);
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
	'react-native-reanimated': 'window.unbound.metro.common.Reanimated',
	'@react-native-clipboard/clipboard': 'window.unbound.metro.common.Clipboard',
	moment: 'window.unbound.metro.common.Moment',
};

/** @type {import('rollup').RollupOptions} */
export default {
	input: 'src/index.tsx',
	external: Object.keys(globals),
	plugins: [
		bunPathAliases(),
		pluginAlias(),
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
