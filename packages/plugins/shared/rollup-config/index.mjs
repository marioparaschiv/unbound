import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { swc } from 'rollup-plugin-swc3';

import { hermesExpressionEntrypoint } from './entrypoint.mjs';
import { lazyModules } from './lazy-modules.mjs';

const runtimeGlobals = {
	'@unbound-app/api': 'window.unbound',
	react: 'window.React',
	'react-native': 'window.ReactNative',
};

// `@unbound-app/api/metro/components` maps to `window.unbound.metro.components`, mirroring the API's namespaces.
function globals(id) {
	if (id.startsWith('@unbound-app/api/')) {
		return `window.unbound.${id.slice('@unbound-app/api/'.length).replaceAll('/', '.')}`;
	}

	return runtimeGlobals[id];
}

function isExternal(id) {
	return Boolean(globals(id));
}

const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];
const indexFiles = ['index.tsx', 'index.ts', 'index.jsx', 'index.js'];

function isFile(path) {
	return existsSync(path) && statSync(path).isFile();
}

function findFile(candidate) {
	if (isFile(candidate)) return candidate;

	for (const extension of extensions) {
		if (isFile(`${candidate}${extension}`)) return `${candidate}${extension}`;
	}

	for (const indexFile of indexFiles) {
		if (isFile(resolve(candidate, indexFile))) return resolve(candidate, indexFile);
	}

	return null;
}

/**
 * Resolves `~/` imports to a plugin's `src` directory, mirroring the `paths` in its tsconfig.
 * @param {string} sourceRoot Absolute path of the plugin's `src` directory.
 */
export function sourceAlias(sourceRoot) {
	return {
		name: 'plugin-source-alias',
		resolveId(source) {
			if (!source.startsWith('~/')) return null;

			return findFile(resolve(sourceRoot, source.slice(2)));
		},
	};
}

function manifestToDist(pluginRoot) {
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

/**
 * Builds the rollup config every plugin shares.
 * @param {string} pluginUrl The `import.meta.url` of the plugin's `rollup.config.mjs`.
 * @param {{ settingsPanel?: boolean, lazyModules?: string[] }} options Set `settingsPanel` when the plugin exports `getSettingsPanel`, and list `lazyModules` whose code should only run once the plugin first uses them.
 */
export function createPluginConfig(
	pluginUrl,
	{ settingsPanel = false, lazyModules: deferred = [] } = {},
) {
	const pluginRoot = fileURLToPath(new URL('.', pluginUrl));
	const sourceRoot = resolve(pluginRoot, 'src');
	const modulePlugins = () => [
		sourceAlias(sourceRoot),
		nodeResolve(),
		commonjs(),
		json(),
		swc({ tsconfig: false }),
	];

	return {
		input: findFile(resolve(sourceRoot, 'index')),
		external: isExternal,
		plugins: [
			lazyModules(deferred, { plugins: modulePlugins, external: isExternal, globals }),
			...modulePlugins(),
			iife(),
			hermesExpressionEntrypoint({ hasSettingsPanel: settingsPanel }),
			manifestToDist(pluginRoot),
		],
		output: {
			dir: resolve(pluginRoot, 'dist'),
			entryFileNames: 'index.js',
			format: 'es',
			compact: true,
			exports: 'named',
			globals,
		},
	};
}

export { hermesExpressionEntrypoint } from './entrypoint.mjs';
export { lazyModules, lazyModuleSource } from './lazy-modules.mjs';
