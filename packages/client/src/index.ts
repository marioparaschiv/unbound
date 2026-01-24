import { createLogger } from '@unbound-app/logger';

import { builtins, plugins, themes } from '~/managers';
import storage from '~/api/storage';
import * as api from '~/api';

export interface UnboundWindowObject extends Omit<typeof api, 'default'> {
	initialize: typeof initialize;
	shutdown: typeof shutdown;
}

declare global {
	var unbound: UnboundWindowObject;
}

const Logger = createLogger('Core');

let initialized = false;

export function initialize() {
	if (initialized) {
		Logger.warn('Unbound already initialized');
		return;
	}

	Logger.info('Initializing Unbound...');

	builtins.initialize();
	plugins.initialize();
	themes.initialize();

	initialized = true;
	Logger.info('Unbound initialized');
}

export async function shutdown() {
	if (!initialized) {
		Logger.warn('Unbound not initialized');
		return;
	}

	Logger.info('Shutting down Unbound...');

	builtins.shutdown();
	themes.shutdown();
	plugins.shutdown();

	await storage.persist();

	initialized = false;

	window.unbound = {
		initialize,
		shutdown,
	} as any;

	Logger.info('Unbound shutdown complete');
}

initialize();

window.unbound = {
	...api,
	initialize,
	shutdown,
};

export default api;
