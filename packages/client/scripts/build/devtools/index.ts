import { rolldown, type OutputOptions, type RolldownOptions } from 'rolldown';
import Logger from '@unbound-app/logger';
import { join } from 'node:path';

import downlevel, { HERMESC_FEATURE_FLAGS, lowerSourceFallback } from '../plugins/downlevel';
import hermesVersions from '../plugins/hermes-versions';
import { bytecodeVersions } from '../hermes.json';
import { IS_DEV_BUILD } from '../constants';

const logger = Logger.create('Build', 'DevTools');

const root = join(__dirname, '..', '..', '..');

/** The console methods the backend reads while it loads. */
const CONSOLE_METHODS = [
	'log',
	'info',
	'warn',
	'error',
	'debug',
	'trace',
	'table',
	'dir',
	'group',
	'groupCollapsed',
	'groupEnd',
	'assert',
];

/**
 * The loader runs the backend before React Native defines `window` and `console`, so both are bound
 * inside the bundle. The stand-in console forwards to the real one once React Native installs it.
 */
export const DEVTOOLS_INTRO = [
	'var window = globalThis;',
	'var self = window;',
	'var console = globalThis.console || {',
	...CONSOLE_METHODS.map(
		(method) =>
			`\t${method}: function () { var c = globalThis.console; c && c.${method} && c.${method}.apply(c, arguments); },`,
	),
	'};',
].join('\n');

const output: OutputOptions = {
	file: 'dist/devtools.js',
	format: 'iife',
	intro: DEVTOOLS_INTRO,
	footer: '//# sourceURL=unbound:devtools',
	minify: true,
};

/** The rolldown config for the DevTools backend: `dist/devtools.js` and `dist/devtools.<bytecode>.bundle`. */
export const devtoolsConfig: RolldownOptions = {
	input: join(__dirname, 'entry.js'),
	cwd: root,
	output,
	plugins: [
		downlevel(root),
		hermesVersions(bytecodeVersions, [
			...HERMESC_FEATURE_FLAGS,
			...(IS_DEV_BUILD ? [] : ['-O', '-g0']),
		]),
		lowerSourceFallback(),
	],
};

/**
 * @description Builds the DevTools backend into `dist/` as source and as bytecode for every version the
 * client ships, beside the client bundles, so the manifest hashes and signs it with them.
 */
export async function buildDevtools(): Promise<void> {
	const bundle = await rolldown(devtoolsConfig);

	try {
		await bundle.write(output);
	} finally {
		await bundle.close();
	}

	logger.success('Built the DevTools backend.');
}
