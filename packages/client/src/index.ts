import '~/api/metro/state';
import '~/lib/cache';
import '~/api/metro';

import { createLogger } from '@unbound-app/logger';

import { askForNativeConsent } from '~/ui/addons/native-consent';
import { setConsentPrompt } from '~/lib/native-consent';
import { builtins } from '~/managers/builtins';
import { managers } from '~/managers/utils';
import storage from '~/api/storage';
import * as api from '~/api';

/** The lifecycle entry points, all the global `unbound` object keeps after {@link shutdown}. */
type UnboundLifecycle = {
	initialize: typeof initialize;
	shutdown: typeof shutdown;
};

/** Shape of the global `unbound` object: the public API surface plus the lifecycle entry points. */
export type UnboundWindowObject = UnboundLifecycle & Omit<typeof api, 'default'>;

declare global {
	var unbound: UnboundWindowObject | UnboundLifecycle;
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

	window.unbound = { ...api, initialize, shutdown };
	Logger.info('Initializing Unbound...');

	setConsentPrompt(askForNativeConsent);
	builtins.initialize();

	for (const manager of Object.values(managers)) {
		manager.initialize();
	}

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

	builtins.shutdown();

	for (const manager of Object.values(managers)) {
		await manager.shutdown();
	}

	await storage.persist();

	initialized = false;

	window.unbound = {
		initialize,
		shutdown,
	};

	Logger.info('Unbound shutdown complete');
}

initialize();

export default api;
