import { rolldown, type RolldownOptions } from 'rolldown';
import { cp, mkdir, rm } from 'node:fs/promises';
import hermes from '@unbound-mod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import Logger from '@unbound-app/logger';
import { execSync } from 'child_process';
import { swc } from 'rollup-plugin-swc3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import globals, { shimmedModules } from './plugins/globals';
import { resolveDevServerUrl } from '../dev-host';
import generateManifest from './plugins/manifest';
import worklets from './plugins/worklets';

const revision = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

const logger = Logger.create('Build');
const pluginLoggers: Map<PropertyKey, Logger> = new Map();

const IGNORED_WARNINGS = ['PLUGIN_TIMINGS', 'EVAL', 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT'];

const PROD_I18N_BASE_URL = 'https://raw.githubusercontent.com/marioparaschiv/unbound/main/i18n';

const dev = process.env.UNBOUND_DEV === '1' || process.argv.includes('--dev');

// The `serve` script's origin, baked into the bundle so the device can fetch
// locale tables and the hot-reload stream. Resolved from `--host <ip>`, then
// `DEV_HOST`/`DEV_SERVER_URL`, then the auto-detected LAN IP - a physical device
// can't reach `localhost` (that's the phone itself), so the LAN IP is the default.
const DEV_SERVER_URL = dev ? resolveDevServerUrl() : '';
const I18N_BASE_URL = dev
	? process.env.I18N_DEV_URL || `${DEV_SERVER_URL}/i18n`
	: PROD_I18N_BASE_URL;

const config: RolldownOptions = {
	input: 'src/entry.ts',
	cwd: join(__dirname, '..', '..'),
	tsconfig: true,
	resolve: {
		alias: {
			'#shims#': './src/shims',
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
			$$VERSION$$: revision,
			$$DEV$$: JSON.stringify(dev),
			$$I18N_BASE_URL$$: I18N_BASE_URL,
			$$DEV_SERVER_URL$$: DEV_SERVER_URL,
		}),
		swc({ tsconfig: false, swcrc: true }),
		// iifeWrapper(preinit),
		// minify({ compress: true, mangle: true }),
		hermes(),
		generateManifest(revision),
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
		logger.info('Revision:', revision);

		if (dev) logger.info('Dev mode - device will connect to:', DEV_SERVER_URL);

		const bundle = await rolldown(config);

		const outputs = Array.isArray(config.output) ? config.output : [config.output];

		for (const output of outputs) {
			if (output) {
				await bundle.write(output);
			}
		}

		await bundle.close();

		if (dev) await copyLocales();

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

build();
