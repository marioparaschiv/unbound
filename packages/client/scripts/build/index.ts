import { rolldown, watch, type RolldownOptions, type OutputOptions, type Plugin } from 'rolldown';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import replace from '@rollup/plugin-replace';
import { dev } from 'rolldown/experimental';
import { join, relative } from 'node:path';
import Logger from '@unbound-app/logger';
import { swc } from 'rollup-plugin-swc3';

import {
	API_URL,
	IS_DEV_BUILD,
	BUILD_CHANNEL,
	GIT_REVISION,
	I18N_BASE_URL,
	CLIENT_VERSION,
	DEV_SERVER_URL,
	IGNORED_WARNINGS,
	DEBUGGER_ADDRESS,
	MINIMUM_DISCORD_VERSIONS,
	MIN_LOADER_VERSION,
} from './constants';
import downlevel, {
	GLOBAL_BANNER,
	HERMESC_FEATURE_FLAGS,
	lower,
	lowerSourceFallback,
} from './plugins/downlevel';
import generateManifest, { writeManifest } from './plugins/manifest';
import globals, { shimmedModules } from './plugins/globals';
import hermesVersions from './plugins/hermes-versions';
import releaseModules from './plugins/release-modules';
import staticAssets from './plugins/static-assets';
import { bytecodeVersions } from './hermes.json';
import { buildDevtools } from './devtools';
import worklets from './plugins/worklets';
import libraries from './shim-libraries';
import refresh from './plugins/refresh';
import signBundles from './sign';

/** What the dev engine reports after a source change. */
export type HotUpdate =
	| { type: 'change'; file: string }
	| { type: 'patch'; clientId: string; code: string; filename: string; changedIds: string[] }
	| { type: 'reload'; reason: string }
	| { type: 'failed'; error: string }
	| { type: 'built' };

const logger = Logger.create('Build');
const pluginLoggers: Map<PropertyKey, Logger> = new Map();
const localeSource = join(__dirname, '..', '..', '..', '..', 'i18n');
const localeTarget = join(__dirname, '..', '..', 'dist', 'i18n');

const root = join(__dirname, '..', '..');

/** One bundle the client ships: the file stem, and whether it keeps the developer tooling. */
export type Flavour = {
	/** The file stem: `dist/<name>.js`, and `dist/<name>.<bytecode>.bundle` beside it. */
	name: string;
	/** Whether the bundle carries the debugger and the hot-refresh runtime. */
	devTools: boolean;
};

/** The bundle every loader downloads, and the larger one Developer mode loads instead. */
export const DEFAULT_FLAVOUR: Flavour = { name: 'unbound', devTools: false };
export const DEV_FLAVOUR: Flavour = { name: 'unbound-dev', devTools: true };

/** The modules the default bundle swaps for the release twin that drops the developer tooling. */
const RELEASE_MODULES: Record<string, string> = {
	'~/hot-refresh/runtime': join(root, 'src', 'hot-refresh', 'runtime.release.ts'),
};

/**
 * @description Builds one flavour's rolldown config. Each call makes its own plugin instances, so a build
 * can hold one config per flavour.
 * @param flavour The bundle to build.
 * @param manifest Whether to write `dist/manifest.json` when this build finishes. Off when both flavours
 * build first and the one manifest hashes both.
 * @returns The rolldown config.
 */
function createConfig(flavour: Flavour, manifest = true): RolldownOptions {
	// A local dev build hot-patches its own modules, which needs the full runtime whatever the flavour.
	const devTools = flavour.devTools || IS_DEV_BUILD;

	return {
		input: 'src/core/entry.ts',
		cwd: root,
		tsconfig: true,
		resolve: {
			alias: {
				'#shims#': './src/core/shims',
			},
		},
		// Each flag becomes a literal, so `if (import.meta.env.DEV_TOOLS)` folds to `if (false)` in the default
		// bundle and DCE prunes the branch and the `*.dev.ts` modules only it imports.
		transform: {
			define: {
				$$DEV$$: JSON.stringify(IS_DEV_BUILD),
				'import.meta.env.DEV': JSON.stringify(IS_DEV_BUILD),
				'import.meta.env.DEV_TOOLS': JSON.stringify(devTools),
			},
		},
		// The store page imports the ADDON.md contract but never parses YAML; yaml declares no `sideEffects`.
		// A `*.dev.ts` module's top level (loggers, style sheets) runs only if something reaches its exports.
		treeshake: {
			moduleSideEffects: [
				{ test: /[\\/]node_modules[\\/]yaml[\\/]/, sideEffects: false },
				{ test: /\.dev\.tsx?$/, sideEffects: false },
			],
		},
		output: [
			{
				postBanner: GLOBAL_BANNER.trimEnd(),
				footer: '//# sourceURL=unbound',
				// `__PURE__` annotations only matter to a later bundler; the shipped JS has none.
				comments: { annotation: false },
				file: `dist/${flavour.name}.js`,
				format: 'iife',
				minify: !IS_DEV_BUILD,
				sourcemap: IS_DEV_BUILD ? false : 'hidden',
				inlineDynamicImports: true,
			},
		],

		plugins: [
			globals(shimmedModules(['react', 'react-native', ...Object.keys(libraries)])),
			// A local dev build keeps every module; the default release bundle swaps in the lean twins.
			releaseModules(devTools ? {} : RELEASE_MODULES),
			worklets(),
			replace({
				preventAssignment: true,
				$$VERSION$$: GIT_REVISION,
				$$CLIENT_VERSION$$: CLIENT_VERSION,
				$$BUILD_CHANNEL$$: BUILD_CHANNEL,
				$$API_URL$$: API_URL,
				$$I18N_BASE_URL$$: I18N_BASE_URL,
				$$DEBUGGER_ADDRESS$$: DEBUGGER_ADDRESS,
				$$DEV_SERVER_URL$$: DEV_SERVER_URL,
				$$MINIMUM_DISCORD_ANDROID$$: MINIMUM_DISCORD_VERSIONS.android,
				$$MINIMUM_DISCORD_IOS$$: MINIMUM_DISCORD_VERSIONS.ios,
			}),
			// Only strips TS and JSX; class fields stay native, which Hermes runs. `downlevel` lowers the rest
			// once per chunk, sharing each helper.
			swc({
				tsconfig: false,
				swcrc: false,
				exclude: /node_modules/,
				jsc: { target: 'es2022' },
				sourceMaps: !IS_DEV_BUILD,
			}),
			downlevel(root),
			// Stripping function names saves ~15 bytes per function; release stack frames then name no function,
			// and `symbolicate` recovers file and line from the source map.
			hermesVersions(bytecodeVersions, [
				...HERMESC_FEATURE_FLAGS,
				...(IS_DEV_BUILD
					? []
					: ['-O', '-g0', '-output-source-map', '-fstrip-function-names']),
			]),
			// The shipped JavaScript is the loader's fallback on other bytecode versions; hermesc compiled first.
			lowerSourceFallback(),
			...(manifest
				? [
						generateManifest(
							GIT_REVISION,
							bytecodeVersions,
							IS_DEV_BUILD,
							BUILD_CHANNEL,
							MIN_LOADER_VERSION,
						),
					]
				: []),
			// Both flavours share the static files and locale tables, so the default build copies them once.
			...(flavour === DEFAULT_FLAVOUR ? [staticAssets(root)] : []),
			...(IS_DEV_BUILD && flavour === DEFAULT_FLAVOUR ? [locales()] : []),
		],

		onLog(level, log) {
			if (log.code && IGNORED_WARNINGS.includes(log.code)) return;

			if (!log.plugin) {
				return logger[level](log.message);
			}

			if (log.plugin && !pluginLoggers.has(log.plugin)) {
				pluginLoggers.set(log.plugin, Logger.create('Build', log.plugin));
			}

			const _logger = pluginLoggers.get(log.plugin);

			if (!_logger) {
				return console[level](log.message);
			}

			_logger[level](log.message);
		},
	};
}

/** The config the dev loops build (watch and hot reload), and the tests inspect: one flavour, one manifest. */
export const config = createConfig(DEFAULT_FLAVOUR);

/** The second flavour `build()` writes. */
export const devConfig = createConfig(DEV_FLAVOUR);

/**
 * Mirrors the repo-root `i18n/` tables into `dist/i18n/` so `serve` exposes them beside the bundle.
 * Dev-only: production builds fetch from GitHub raw instead.
 */
async function copyLocales() {
	if (!existsSync(localeSource)) {
		logger.warn(`No i18n/ directory at ${localeSource}; skipping locale copy.`);

		return;
	}

	await rm(localeTarget, { recursive: true, force: true });
	await mkdir(localeTarget, { recursive: true });
	await cp(localeSource, localeTarget, { recursive: true });

	logger.success('Copied i18n/ locale tables into dist/i18n.');
}

/** Watches and copies the locale tables as part of every dev build cycle. */
function locales(): Plugin {
	return {
		name: 'locales',
		buildStart() {
			if (!existsSync(localeSource)) return;

			for (const file of readdirSync(localeSource).filter((file) => file.endsWith('.json'))) {
				this.addWatchFile(join(localeSource, file));
			}
		},
		writeBundle: copyLocales,
	};
}

/**
 * @description Builds one flavour into `dist/`, without the manifest both flavours share.
 * @param flavour The bundle to build.
 */
async function writeFlavour(flavour: Flavour) {
	const options = createConfig(flavour, false);
	const bundle = await rolldown(options);

	try {
		for (const output of [options.output].flat()) {
			if (output) {
				await bundle.write(output);
			}
		}
	} finally {
		await bundle.close();
	}
}

async function build() {
	const startTime = performance.now();

	try {
		logger.debug('Building Unbound...');
		logger.info('Revision:', GIT_REVISION);

		if (IS_DEV_BUILD) {
			logger.info('Dev mode - device will connect to:', DEV_SERVER_URL);
		}

		// One flavour after the other: the hermesc plugin resolves its binaries into a shared cache
		// while it writes, so a cold cache would have both builds downloading into the same directory.
		for (const flavour of [DEFAULT_FLAVOUR, DEV_FLAVOUR]) {
			await writeFlavour(flavour);
		}

		await buildDevtools();

		const problem = writeManifest({
			revision: GIT_REVISION,
			declared: bytecodeVersions,
			lenient: IS_DEV_BUILD,
			channel: BUILD_CHANNEL,
			minLoaderVersion: MIN_LOADER_VERSION,
		});

		if (problem) {
			throw new Error(problem);
		}

		signBundles(join(root, 'dist'));

		const endTime = performance.now();
		const duration = (endTime - startTime).toFixed(2);

		logger.success(`Build completed successfully in ${duration}ms`);
	} catch (error) {
		const endTime = performance.now();
		const duration = (endTime - startTime).toFixed(2);

		logger.error(`Build failed after ${duration}ms:`, error);
		process.exit(1);
	}
}

/**
 * Builds in watch mode: rebuilds on every `src/` change and logs each cycle's start, duration, and
 * errors. Returns the `RolldownWatcher` so an orchestrator can close it on shutdown.
 */
function watchBuild() {
	const watcher = watch(config);

	watcher.on('event', (event) => {
		switch (event.code) {
			case 'BUNDLE_START':
				logger.debug('Rebuilding Unbound...');
				break;
			case 'BUNDLE_END':
				logger.success(`Build completed successfully in ${event.duration.toFixed(2)}ms`);
				break;
			case 'ERROR':
				logger.error('Build failed:', event.error);
				break;
			default:
				break;
		}
	});

	return watcher;
}

/**
 * @description Builds with rolldown's dev engine: the bundle registers every module's exports, and each
 * source change becomes a hot patch for every connected client, then a rebuild for the next launch.
 * @param onUpdate Receives each client's patch, or a reload when a change could not be patched.
 * @returns The dev engine, to register clients with and close on shutdown.
 */
async function hotBuild(onUpdate: (update: HotUpdate) => void) {
	const [output] = Array.isArray(config.output) ? config.output : [config.output];
	// Rolldown's dev mode only emits ESM.
	const hotOutput: OutputOptions = { ...output, format: 'esm' };

	const engine = await dev(
		{
			...config,
			plugins: [
				refresh(root, '~/hot-refresh/runtime'),
				config.plugins,
				{
					name: 'hot-changes',
					watchChange: (id) => onUpdate({ type: 'change', file: relative(root, id) }),
				},
			],
			experimental: {
				devMode: {
					implement: readFileSync(join(__dirname, 'dev-runtime.js'), 'utf8'),
					// Its classes don't compile with hermesc; dev-runtime.js implements the same surface.
					skipCommonRuntimeInjection: true,
				},
			},
		},
		hotOutput,
		{
			rebuildStrategy: 'always',
			onHmrUpdates(result) {
				if (result instanceof Error) {
					logger.error('Hot update failed:', result);
					onUpdate({ type: 'failed', error: `Hot update failed: ${result.message}` });

					return;
				}

				for (const { clientId, update } of result.updates) {
					if (update.type === 'Patch') {
						onUpdate({
							type: 'patch',
							clientId,
							// Patches skip `renderChunk`, so the dependency code they carry is lowered here.
							code: lower(root, update.code).code,
							filename: update.filename,
							changedIds: update.changedIds,
						});
					} else if (update.type === 'FullReload') {
						const reason = update.reason ?? 'no reason given';

						logger.info(`Full reload: ${reason}`);
						onUpdate({ type: 'reload', reason });
					}
				}
			},
			onOutput(result) {
				if (result instanceof Error) {
					logger.error('Build failed:', result);
					onUpdate({ type: 'failed', error: `Build failed: ${result.message}` });

					return;
				}

				logger.success('Build completed successfully');
				onUpdate({ type: 'built' });
			},
		},
	);

	await engine.run();

	return engine;
}

export { build, watchBuild, hotBuild };

if (import.meta.main) {
	if (process.argv.includes('--watch')) {
		watchBuild();
	} else {
		build();
	}
}
