import { createLogger } from '@structures/logger';
import * as Managers from '@managers';
import BuiltIns from '@core/builtins';
import Patches from '@core/patches';
import Patcher from '@api/patcher';
import * as API from '@api';

const Logger = createLogger('Core');

export async function initialize() {
	try {
		await Patches.apply();
	} catch (e) {
		Logger.error('Failed to apply patches:', e.message);
	}

	try {
		await BuiltIns.initialize();
	} catch (e) {
		Logger.error('Failed to apply built-ins:', e.message);
	}

	window.unbound = Object.assign(API, { version: '__VERSION__' });

	Managers.Plugins.initialize();
	Managers.Sources.initialize();

	return API;
}

export async function shutdown() {
	Patcher.unpatchAll();

	for (const type in Managers) {
		const manager = Managers[type];
		if (!manager.initialized) continue;

		await manager.shutdown();
	}

	Patches.remove();
	BuiltIns.shutdown();

	delete window.unbound;
}

export default { initialize, shutdown };