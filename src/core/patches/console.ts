import { findByProps } from '@api/metro';
import { getStore } from '@api/storage';
import { addLog } from '@stores/logger';

export enum Levels {
	error = 3,
	info = 1,
	log = 1,
	warn = 2,
	trace = 0,
	debug = 0,
};

const settings = getStore('unbound');
const methods = ['error', 'info', 'log', 'warn', 'trace', 'debug'];

export function apply() {
	const Util = findByProps('inspect', { lazy: true });

	for (const method of methods) {
		console[method].__ORIGINAL__ = console[method];

		console[method] = (...args) => {
			const payload = [];

			for (let i = 0, len = args.length; len > i; i++) {
				const item = args[i];
				const out = typeof item === 'string' ? item : Util.inspect?.(item, { depth: settings.get('dev.logging.depth', 3) });

				payload.push(out ?? item.toString());
			}

			const output = payload.join(' ');

			addLog({ message: output, level: Levels[method] });
			nativeLoggingHook(output, Levels[method] ?? Levels.info);
		};
	}
}

export function remove() {
	for (const method of methods) {
		const orig = console[method].__ORIGINAL__;
		if (!orig) continue;

		console[method] = orig;
	}
}