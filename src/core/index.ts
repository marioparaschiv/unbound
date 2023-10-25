import '@api/components';

import { createLogger } from '@logger';
import BuiltIns from '@core/builtins';
import Patches from '@core/patches';

import * as Managers from '@api/managers';
import Patcher from '@api/patcher';
import * as API from '@api';

const Logger = createLogger('Core');

export async function initialize() {
	try {
		Patches.apply();
	} catch (e) {
		Logger.error('Failed to apply patches:', e.message);
	}

	try {
		BuiltIns.initialize();
	} catch (e) {
		Logger.error('Failed to apply built-ins:', e.message);
	}

	window.unbound = Object.assign(API, { version: '__VERSION__' });

	Managers.plugin.initialize();

	return API;
}

export async function shutdown() {
	Patcher.unpatchAll();

	for (const type in Managers) {
		const manager = Managers[type];
		await manager.shutdown();
	}

	Patches.remove();
	BuiltIns.shutdown();

	delete window.unbound;
}

export default { initialize, shutdown };