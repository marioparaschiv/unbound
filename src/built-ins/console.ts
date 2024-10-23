import type { BuiltInData } from '@typings/built-ins';
import { Util } from '@api/metro/common';
import { getStore } from '@api/storage';
import { addLog } from '@stores/logger';


export const data: BuiltInData = {
	name: 'Console'
};

const Settings = getStore('unbound');

export enum Levels {
	error = 3,
	info = 1,
	log = 1,
	warn = 2,
	trace = 0,
	debug = 0,
};

export function start() {
	for (const method of ['error', 'info', 'log', 'warn', 'trace', 'debug']) {
		console[method].__ORIGINAL__ = console[method];

		console[method] = (...args) => {
			const depth = Settings.get('logging.depth', 2);
			const payload = [];

			for (let i = 0, len = args.length; len > i; i++) {
				const item = args[i];
				const out = typeof item === 'string' ? item : Util.inspect?.(item, { depth });

				payload.push(out ?? item.toString());
			}

			const output = payload.join(' ');

			addLog({ message: output, level: Levels[method] });
			window.nativeLoggingHook(output, Levels[method] ?? Levels.info);
		};
	}
}

export function stop() {
	for (const method of ['error', 'info', 'log', 'warn', 'trace', 'debug']) {
		const orig = console[method].__ORIGINAL__;
		if (!orig) continue;

		console[method] = orig;
	}
}