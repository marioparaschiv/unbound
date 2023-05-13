import { BuiltIn } from '@typings/core/builtins';
import * as instances from './registry';
import { createLogger } from '@logger';
import Storage from '@api/storage';

const Logger = createLogger('Core', 'Built-Ins');

export const settings = Storage.getStore('unbound');
export const started = new Set<string>();

export function initialize() {
	for (const id in instances) {
		const instance = instances[id] as BuiltIn;

		if (settings.get(instance.data.id, instance.data.default ?? true)) {
			start(id);
		}
	}
}

export function shutdown() {
	for (const id of started) {
		stop(id);
	}
}

export function start(id: string) {
	if (!instances[id]) return;
	if (started.has(id)) return;

	const instance = instances[id] as BuiltIn;

	try {
		instance.initialize?.();
		started.add(id);
	} catch (e) {
		started.delete(id);
		Logger.error(`Failed to initialize built-in ${id}:`, e.message);
	}
}

export function stop(id: string) {
	if (!instances[id]) return;
	if (!started.has(id)) return;

	const instance = instances[id] as BuiltIn;

	try {
		instance.shutdown?.();
		started.delete(id);
	} catch (e) {
		started.add(id);
		Logger.error(`Failed to shutdown built-in ${id}:`, e.message);
	}
}

function onSettingsChange({ store, key, value }: { store: string, key: string, value: any; }) {
	if (store !== 'unbound') return;

	for (const id in instances) {
		const instance = instances[id] as BuiltIn;

		if (instance.data.id === key) {
			const handler = value ? start : stop;

			handler(id);
		} else if (instance.data.settings?.includes(key) && started.has(id)) {
			stop(id);
			start(id);
		};
	}
}

Storage.on('changed', onSettingsChange);

export default { initialize, shutdown, start, stop };