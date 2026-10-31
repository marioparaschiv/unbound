import '~/api/metro/state';
import '~/lib/cache';
import '~/api/metro';

import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import { askForNativeConsent } from '~/ui/addons/native-consent';
import discordSupport from '~/builtins/discord-support';
import { setConsentPrompt } from '~/lib/native-consent';
import type { BuiltInEntry } from '~/managers/builtins';
import errorBoundary from '~/builtins/error-boundary';
import coreCommands from '~/builtins/core-commands';
import hotRefresh from '~/builtins/hot-refresh';
import { builtins } from '~/managers/builtins';
import { Manager } from '~/managers/base';
import cloudSync from '~/builtins/cloud-sync';
import staffMode from '~/builtins/staff-mode';
import commands from '~/builtins/commands';
import settings from '~/builtins/settings';
import tracking from '~/builtins/tracking';
import updater from '~/builtins/updater';
import debug from '~/builtins/debugger';
import themes from '~/builtins/themes';
import toasts from '~/builtins/toasts';
import links from '~/builtins/links';
import storage from '~/api/storage';
import i18n from '~/builtins/i18n';
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

const BUILT_INS: BuiltInEntry[] = [
	['cloudSync', cloudSync],
	['commands', commands],
	['coreCommands', coreCommands],
	['debug', debug],
	['discordSupport', discordSupport],
	['errorBoundary', errorBoundary],
	['hotRefresh', hotRefresh],
	['i18n', i18n],
	['links', links],
	['settings', settings],
	['staffMode', staffMode],
	['themes', themes],
	['toasts', toasts],
	['tracking', tracking],
	['updater', updater],
];

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
	builtins.initialize(BUILT_INS);

	for (const kind of ADDON_KINDS) {
		Manager.for(kind).initialize();
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

	for (const kind of ADDON_KINDS) {
		await Manager.for(kind).shutdown();
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
