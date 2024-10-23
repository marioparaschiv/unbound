import type { BuiltIn } from '@typings/built-ins';
import { createLogger } from '@structures/logger';
import * as instances from './registry';
import Storage from '@api/storage';


export const started = new Set<string>();

const Logger = createLogger('Core', 'Built-Ins');

const mdls = Object.values<BuiltIn>(instances);

export function initialize() {
	for (const mdl of mdls) {
		const predicate = mdl.data.shouldInitialize ?? true;

		if (typeof predicate === 'function' ? predicate() : predicate) {
			start(mdl);
		};
	}
}

export function shutdown() {
	for (const name of started) {
		const mdl = mdls.find(m => m.data.name === name);
		if (!mdl) {
			started.delete(name);
			continue;
		}

		stop(mdl);
	}
}

export async function start(mdl: BuiltIn) {
	if (started.has(mdl.data.name)) return;

	try {
		await mdl.start?.();
		started.add(mdl.data.name);
		Logger.success(`Started ${mdl.data.name}.`);
	} catch (e) {
		started.delete(mdl.data.name);
		Logger.error(`Failed to initialize built-in ${mdl.data.name}: ${e.message}`);
	}
}

export async function stop(mdl: BuiltIn) {
	if (!started.has(mdl.data.name)) return;

	try {
		await mdl.stop?.();
		started.delete(mdl.data.name);
		Logger.success(`Stopped ${mdl.data.name}.`);
	} catch (e) {
		started.add(mdl.data.name);
		Logger.error(`Failed to shutdown built-in ${mdl.data.name}: ${e.message}`);
	}
}

async function onSettingsChange({ store, key }: { store: string, key: string; }) {
	if (store !== 'unbound') return;

	for (const mdl of mdls) {
		if (!mdl.data.settings) continue;

		const monitors = mdl.data.settings.monitor;
		if (!monitors?.length || !monitors.includes(key)) continue;

		if (started.has(mdl.data.name)) {
			await stop(mdl);
		}

		const predicate = mdl.data.shouldInitialize ?? true;

		if (typeof predicate === 'function' ? predicate() : predicate) {
			start(mdl);
		};
	}
}

Storage.on('changed', onSettingsChange);

export default { initialize, shutdown, start, stop };