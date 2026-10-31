import hermes from '@unbound-app/client-build/hermes.json' with { type: 'json' };
import { nodeResolve } from '@rollup/plugin-node-resolve';
import type { Plugin, RollupOptions } from 'rollup';
import { minify, swc } from 'rollup-plugin-swc3';
import commonjs from '@rollup/plugin-commonjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import json from '@rollup/plugin-json';
import { readFileSync } from 'node:fs';
import iife from 'rollup-plugin-iife';

import type { Globals } from './globals.ts';

import { hermesExpressionEntrypoint } from './entrypoint.ts';
import { externalFor, unboundGlobals } from './globals.ts';
import { findFile, sourceAlias } from './source-alias.ts';
import { hermesBytecode } from './hermes-bytecode.ts';
import { lazyModules } from './lazy-modules.ts';
import { worklets } from './worklets.ts';

export type PluginConfigOptions = {
	settingsPanel?: boolean;
	lazyModules?: string[];
	bytecode?: boolean;
};

const minifyOptions = {
	compress: { keep_classnames: true, keep_fnames: true },
	mangle: false,
	keep_classnames: true,
	keep_fnames: true,
};

function manifestToDist(pluginRoot: string): Plugin {
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
 * @description Builds a plugin's rollup config with the given runtime globals.
 * @param pluginUrl The `import.meta.url` of the plugin's `rollup.config.mjs`.
 * @param globals Maps each import the client provides at runtime to its global.
 * @param options Set `settingsPanel` when the plugin exports `getSettingsPanel`, list `lazyModules` to run only on first use, and set `bytecode: false` to skip Hermes bytecode.
 * @returns The rollup config.
 */
export function pluginConfig(
	pluginUrl: string,
	globals: Globals,
	options: PluginConfigOptions = {},
): RollupOptions {
	const { settingsPanel = false, lazyModules: deferred = [], bytecode = true } = options;
	const pluginRoot = dirname(fileURLToPath(pluginUrl));
	const sourceRoot = resolve(pluginRoot, 'src');
	const external = externalFor(globals);
	const modulePlugins = () => [
		sourceAlias(sourceRoot),
		nodeResolve(),
		commonjs(),
		json(),
		worklets(),
		swc({ tsconfig: false }),
	];

	return {
		input: findFile(resolve(sourceRoot, 'index')) ?? void 0,
		external,
		plugins: [
			lazyModules(deferred, { plugins: modulePlugins, external, globals }),
			...modulePlugins(),
			iife(),
			minify(minifyOptions),
			hermesExpressionEntrypoint({ hasSettingsPanel: settingsPanel }),
			...(bytecode ? [hermesBytecode({ versions: hermes.bytecodeVersions })] : []),
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

/**
 * @description The Unbound plugin preset: bundles `src/index`, reads `unbound`, `React` and the other shared libraries from the bare globals, and emits the manifest and the Hermes expression entrypoint.
 * @param pluginUrl The `import.meta.url` of the plugin's `rollup.config.mjs`.
 * @param options Set `settingsPanel` when the plugin exports `getSettingsPanel`, list `lazyModules` to run only on first use, and set `bytecode: false` to skip Hermes bytecode.
 * @returns The rollup config.
 */
export function unbound(pluginUrl: string, options: PluginConfigOptions = {}): RollupOptions {
	return pluginConfig(pluginUrl, unboundGlobals, options);
}

export default { pluginConfig, unbound };
