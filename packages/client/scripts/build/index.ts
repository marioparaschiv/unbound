import { rolldown, watch, type RolldownOptions } from 'rolldown';
import { cp, mkdir, rm } from 'node:fs/promises';
import { minify, swc } from 'rollup-plugin-swc3';
import hermes from '@unbound-mod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import Logger from '@unbound-app/logger';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
	IS_DEV_BUILD,
	GIT_REVISION,
	I18N_BASE_URL,
	DEV_SERVER_URL,
	IGNORED_WARNINGS,
	DEBUGGER_ADDRESS,
} from './constants';
import globals, { shimmedModules } from './plugins/globals';
import generateManifest from './plugins/manifest';
import worklets from './plugins/worklets';

const logger = Logger.create('Build');
const pluginLoggers: Map<PropertyKey, Logger> = new Map();

const config: RolldownOptions = {
	input: 'src/entry.ts',
	cwd: join(__dirname, '..', '..'),
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
			banner: 'var global = globalThis;',
			footer: '//# sourceURL=unbound',
			file: 'dist/unbound.js',
			format: 'iife',
			inlineDynamicImports: true,
		},
	],

	plugins: [
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
			$$I18N_BASE_URL$$: I18N_BASE_URL,
			$$DEBUGGER_ADDRESS$$: DEBUGGER_ADDRESS,
		}),
		swc({ tsconfig: false, swcrc: true, exclude: /node_modules\/(?!\.bun\/possess|possess)/ }),
		minify({ compress: true, mangle: true }),
		hermes(),
		generateManifest(GIT_REVISION),
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
		if (!_logger) return console[level](log.message);

		_logger[level](log.message);
	},
};

/**
 * Mirrors the repo-root `i18n/` locale tables into `dist/i18n/` so the `serve`
 * script exposes them at the same origin as the bundle. Dev-only: production
 * builds fetch from GitHub raw instead.
 */
async function copyLocales() {
	const source = join(__dirname, '..', '..', '..', '..', 'i18n');
	const target = join(__dirname, '..', '..', 'dist', 'i18n');

	if (!existsSync(source)) {
		logger.warn(`No i18n/ directory at ${source}; skipping locale copy.`);
		return;
	}

	await rm(target, { recursive: true, force: true });
	await mkdir(target, { recursive: true });
	await cp(source, target, { recursive: true });

	logger.success('Copied i18n/ locale tables into dist/i18n.');
}

async function build() {
	const startTime = performance.now();

	try {
		logger.debug('Building Unbound...');
		logger.info('Revision:', GIT_REVISION);

		if (IS_DEV_BUILD) logger.info('Dev mode - device will connect to:', DEV_SERVER_URL);

		const bundle = await rolldown(config);

		const outputs = Array.isArray(config.output) ? config.output : [config.output];

		for (const output of outputs) {
			if (output) {
				await bundle.write(output);
			}
		}

		await bundle.close();

		if (IS_DEV_BUILD) await copyLocales();

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
		}
	});

	return watcher;
}

export { config, build, watchBuild };

// Only dispatch when run directly (`bun scripts/build`); stays inert when the dev orchestrator
// imports `watchBuild`.
if (import.meta.main) {
	if (process.argv.includes('--watch')) {
		watchBuild();
	} else {
		build();
	}
}
