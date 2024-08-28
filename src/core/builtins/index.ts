import type { BuiltIn } from '@typings/core/builtins';
import { createLogger } from '@structures/logger';
import Storage from '@api/storage';

import * as instances from './registry';

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

export async function start(id: string) {
	if (!instances[id]) return;
	if (started.has(id)) return;

	const instance = instances[id] as BuiltIn;

	try {
		await instance.initialize?.();
		started.add(id);
	} catch (e) {
		started.delete(id);
		Logger.error(`Failed to initialize built-in ${id}: ${e.message}`);
	}
}

export async function stop(id: string) {
	if (!instances[id]) return;
	if (!started.has(id)) return;

	const instance = instances[id] as BuiltIn;

	try {
		await instance.shutdown?.();
		started.delete(id);
	} catch (e) {
		started.add(id);
		Logger.error(`Failed to shutdown built-in ${id}: ${e.message}`);
	}
}

async function onSettingsChange({ store, key, value }: { store: string, key: string, value: any; }) {
	if (store !== 'unbound') return;

	for (const id in instances) {
		const instance = instances[id] as BuiltIn;

		if (instance.data.id === key) {
			const handler = value ? start : stop;

			handler(id);
		} else if (instance.data.settings?.includes(key) && started.has(id)) {
			await stop(id);
			start(id);
		};
	}
}

Storage.on('changed', onSettingsChange);

export default { initialize, shutdown, start, stop };