import hermes from '@unbound-app/client-build/hermes.json' with { type: 'json' };
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { basename, dirname, resolve } from 'node:path';
import type { Plugin, RollupOptions } from 'rollup';
import { minify, swc } from 'rollup-plugin-swc3';
import commonjs from '@rollup/plugin-commonjs';
import { fileURLToPath } from 'node:url';
import json from '@rollup/plugin-json';
import { readFileSync } from 'node:fs';
import iife from 'rollup-plugin-iife';

import type { BudgetOptions } from './build-report.ts';
import type { Globals } from './globals.ts';

import { settingsModule, settingsPanel, type SettingsState } from './settings.ts';
import { assetImports, assets, createAssetCollector } from './assets.ts';
import { BUILD_REPORT_ENV, buildReport } from './build-report.ts';
import { hermesExpressionEntrypoint } from './entrypoint.ts';
import { externalFor, unboundGlobals } from './globals.ts';
import { findFile, sourceAlias } from './source-alias.ts';
import { commandLocales } from './command-locales.ts';
import { hermesBytecode } from './hermes-bytecode.ts';
import { localeModule, locales } from './locales.ts';
import { entryExports } from './entry-exports.ts';
import { lazyModules } from './lazy-modules.ts';
import { localeHooks } from './locale-hooks.ts';
import { filterKeys } from './filter-keys.ts';
import { outputOnly } from './output-only.ts';
import { svgImports } from './svg-assets.ts';
import { shimImports } from './shims.ts';
import { worklets } from './worklets.ts';

export type PluginConfigOptions = {
	lazyModules?: string[];
	bytecode?: boolean;
	budget?: BudgetOptions;
};

// `ubd dev` and `ubd push` set UNBOUND_HOT: components register for hot refresh and keep their hooks' state on push.
const hot = process.env.UNBOUND_HOT === '1';

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
 * @param options List `lazyModules` to run only on first use, set `bytecode: false` to skip Hermes bytecode, and `budget` to change the build report's size limits.
 * @returns The rollup config.
 */
export function pluginConfig(
	pluginUrl: string,
	globals: Globals,
	options: PluginConfigOptions = {},
): RollupOptions {
	const { lazyModules: deferred = [], bytecode = true, budget } = options;
	const pluginRoot = dirname(fileURLToPath(pluginUrl));
	const sourceRoot = resolve(pluginRoot, 'src');
	const input = findFile(resolve(sourceRoot, 'index')) ?? void 0;
	const external = externalFor(globals);
	const images = createAssetCollector();
	const settings: SettingsState = {};
	// Each lazy module builds on its own, with its own settings state; only the main build has the entry.
	const modulePlugins = (state?: SettingsState) => [
		settingsModule(pluginRoot, state),
		localeModule(pluginRoot),
		svgImports(pluginRoot),
		assetImports(pluginRoot, images),
		// Before every source transform, so its positions are the source file's.
		commandLocales(pluginRoot),
		sourceAlias(sourceRoot),
		nodeResolve(),
		commonjs(),
		json(),
		// Before swc, so React Refresh signatures include the `useMessages()` it adds.
		localeHooks(pluginRoot),
		worklets(),
		swc({
			tsconfig: false,
			// swc applies `refresh` only in development mode.
			jsc: {
				transform: {
					react: { refresh: hot && { emitFullSignatures: true }, development: hot },
				},
			},
		}),
		shimImports(),
	];

	return {
		input,
		external,
		plugins: [
			// The entry's own exports are checked before the generated panel is re-exported from it.
			...(input ? [entryExports(input, pluginRoot), settingsPanel(input, settings)] : []),
			lazyModules(deferred, { plugins: () => modulePlugins(), external, globals }),
			...modulePlugins(settings),
			filterKeys(pluginRoot),
			outputOnly(iife()),
			outputOnly(minify(minifyOptions)),
			outputOnly(hermesExpressionEntrypoint()),
			...(bytecode
				? [
						outputOnly(
							hermesBytecode({
								versions: hermes.bytecodeVersions,
								sourceName: basename(pluginRoot),
							}),
						),
					]
				: []),
			manifestToDist(pluginRoot),
			locales(pluginRoot),
			assets(pluginRoot, images),
			buildReport({ pluginRoot, budget, reportFile: process.env[BUILD_REPORT_ENV] }),
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
 * @param options List `lazyModules` to run only on first use, set `bytecode: false` to skip Hermes bytecode, and `budget` to change the build report's size limits.
 * @returns The rollup config.
 */
export function unbound(pluginUrl: string, options: PluginConfigOptions = {}): RollupOptions {
	return pluginConfig(pluginUrl, unboundGlobals, options);
}

export default { pluginConfig, unbound };
