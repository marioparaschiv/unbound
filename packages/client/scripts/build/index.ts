import { rolldown, watch, type RolldownOptions, type OutputOptions, type Plugin } from 'rolldown';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import replace from '@rollup/plugin-replace';
import { dev } from 'rolldown/experimental';
import Logger from '@unbound-app/logger';
import { swc } from 'rollup-plugin-swc3';
import { join } from 'node:path';

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
} from './constants';
import globals, { shimmedModules } from './plugins/globals';
import refresh, { refreshRuntime } from './plugins/refresh';
import downlevel, { lower } from './plugins/downlevel';
import generateManifest from './plugins/manifest';
import hermesVersions from './plugins/hermes-versions';
import { bytecodeVersions } from './hermes.json';
import worklets from './plugins/worklets';
import signBundles from './sign';

/** What the dev engine reports after a source change. */
export type HotUpdate =
	| { type: 'patch'; clientId: string; code: string; filename: string; changedIds: string[] }
	| { type: 'reload' };

const logger = Logger.create('Build');
const pluginLoggers: Map<PropertyKey, Logger> = new Map();
const localeSource = join(__dirname, '..', '..', '..', '..', 'i18n');
const localeTarget = join(__dirname, '..', '..', 'dist', 'i18n');

const root = join(__dirname, '..', '..');

const config: RolldownOptions = {
	input: 'src/entry.ts',
	cwd: root,
	tsconfig: true,
	resolve: {
		alias: {
			'#shims#': './src/shims',
		},
	},
	// `$$DEV$$` is replaced by Oxc's transformer (rolldown's `transform.define`), so `if ($$DEV$$)`
	// folds to `if (false)` and DCE prunes the branch.
	transform: {
		define: {
			$$DEV$$: JSON.stringify(IS_DEV_BUILD),
		},
	},
	output: [
		{
			postBanner: 'var global = globalThis;',
			footer: '//# sourceURL=unbound',
			file: 'dist/unbound.js',
			format: 'iife',
			minify: !IS_DEV_BUILD,
			sourcemap: IS_DEV_BUILD ? false : 'hidden',
			inlineDynamicImports: true,
		},
	],

	plugins: [
		// Every build carries the refresh runtime: its production entry only throws, and plugins
		// built by `ubd dev` register their components with it on release clients too.
		refreshRuntime(root),
		globals(
			shimmedModules([
				'react',
				'react-native',
				'react-native-reanimated',
				'react-native-gesture-handler',
			]),
		),
		worklets(),
		replace({
			preventAssignment: true,
			$$VERSION$$: GIT_REVISION,
			$$CLIENT_VERSION$$: CLIENT_VERSION,
			$$API_URL$$: API_URL,
			$$I18N_BASE_URL$$: I18N_BASE_URL,
			$$DEBUGGER_ADDRESS$$: DEBUGGER_ADDRESS,
			$$DEV_SERVER_URL$$: DEV_SERVER_URL,
			$$MINIMUM_DISCORD_ANDROID$$: MINIMUM_DISCORD_VERSIONS.android,
			$$MINIMUM_DISCORD_IOS$$: MINIMUM_DISCORD_VERSIONS.ios,
		}),
		// Only strips TS and JSX, and lowers class fields so parameter properties stay assigned before
		// field initializers. `downlevel` lowers the rest once per chunk, sharing each helper.
		swc({
			tsconfig: false,
			swcrc: false,
			exclude: /node_modules/,
			jsc: { target: 'es2021' },
			sourceMaps: !IS_DEV_BUILD,
		}),
		downlevel(root),
		hermesVersions(bytecodeVersions, IS_DEV_BUILD ? [] : ['-O', '-g0', '-output-source-map']),
		generateManifest(GIT_REVISION, bytecodeVersions, IS_DEV_BUILD, BUILD_CHANNEL),
		...(IS_DEV_BUILD ? [locales()] : []),
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

async function build() {
	const startTime = performance.now();

	try {
		logger.debug('Building Unbound...');
		logger.info('Revision:', GIT_REVISION);

		if (IS_DEV_BUILD) {
			logger.info('Dev mode - device will connect to:', DEV_SERVER_URL);
		}

		const bundle = await rolldown(config);

		const outputs = Array.isArray(config.output) ? config.output : [config.output];

		for (const output of outputs) {
			if (output) {
				await bundle.write(output);
			}
		}

		await bundle.close();

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
			plugins: [refresh(root, '~/lib/hot/runtime'), config.plugins],
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
						logger.info(`Full reload: ${update.reason ?? 'no reason given'}`);
						onUpdate({ type: 'reload' });
					}
				}
			},
			onOutput(result) {
				if (result instanceof Error) {
					logger.error('Build failed:', result);

					return;
				}

				logger.success('Build completed successfully');
			},
		},
	);

	await engine.run();

	return engine;
}

export { config, build, watchBuild, hotBuild };

if (import.meta.main) {
	if (process.argv.includes('--watch')) {
		watchBuild();
	} else {
		build();
	}
}
