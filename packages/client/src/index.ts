import '~/api/metro/state';
import '~/lib/cache';
import '~/api/metro';

import { createLogger } from '@unbound-app/logger';

import { BuiltIns, Plugins, Themes } from '~/managers';
import storage from '~/api/storage';
import * as api from '~/api';

/** Shape of the global `unbound` object: the public API surface plus the lifecycle entry points. */
export interface UnboundWindowObject extends Omit<typeof api, 'default'> {
	initialize: typeof initialize;
	shutdown: typeof shutdown;
}

declare global {
	var unbound: UnboundWindowObject;
}

const Logger = createLogger('Core');

let initialized = false;

/**
 * @description Brings up the client, initialising the built-ins, plugins, and themes managers in turn. Twin of
 * {@link shutdown}.
 */
export function initialize() {
	if (initialized) {
		Logger.warn('Unbound already initialized');
		return;
	}

	Logger.info('Initializing Unbound...');

	BuiltIns.initialize();
	Plugins.initialize();
	Themes.initialize();

	initialized = true;
	Logger.info('Unbound initialized');
}

/**
 * @description Tears the client back down, shutting down the built-ins, plugins, and themes managers and persisting
 * settings before clearing the global down to the lifecycle entry points. Twin of {@link initialize}.
 * @returns A promise that resolves once settings have been persisted and shutdown is complete.
 */
export async function shutdown() {
	if (!initialized) {
		Logger.warn('Unbound not initialized');
		return;
	}

	Logger.info('Shutting down Unbound...');

	BuiltIns.shutdown();
	Plugins.shutdown();
	Themes.shutdown();

	await storage.persist();

	initialized = false;

	window.unbound = {
		initialize,
		shutdown,
	} as UnboundWindowObject;

	Logger.info('Unbound shutdown complete');
}

window.unbound = {
	...api,
	initialize,
	shutdown,
};

initialize();

export default api;
