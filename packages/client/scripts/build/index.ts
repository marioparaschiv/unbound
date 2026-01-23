import { rolldown, type RolldownOptions } from 'rolldown';
import { minify, swc } from 'rollup-plugin-swc3';
import hermes from '@unbound-mod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import Logger from '@unbound-app/logger';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'node:path';

import generateManifest from './plugins/manifest';
import worklets from './plugins/worklets';
import iifeWrapper from './plugins/iife';
import globals from './plugins/globals';

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

const config: RolldownOptions = {
	input: 'src/entry.ts',
	cwd: join(__dirname, '..', '..'),
	tsconfig: true,
	output: [
		{
			footer: '//# sourceURL=unbound',
			file: 'dist/unbound.js',
			format: 'iife',
			inlineDynamicImports: true,
		},
	],

	plugins: [
		globals({
			react: 'globalThis.React',
			'react-native': 'globalThis.ReactNative',
			'react-native-reanimated': 'globalThis.ReactNativeReanimated',
		}),
		worklets(),
		replace({ preventAssignment: true, $$VERSION$$: revision }),
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

async function build() {
	const startTime = performance.now();

	try {
		logger.debug('Building Unbound...');
		logger.info('Revision:', revision);

		const bundle = await rolldown(config);

		const outputs = Array.isArray(config.output) ? config.output : [config.output];

		for (const output of outputs) {
			if (output) {
				await bundle.write(output);
			}
		}

		await bundle.close();

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
