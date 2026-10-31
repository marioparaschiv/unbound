import '~/metro/state';
import '~/metro/cache';
import '~/metro';

import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import {
	createSettings,
	developerSection,
	generalSection,
	panelHostSection,
} from '~/settings/builtin';
import { marketplaceSection, storePageSection } from '~/marketplace/builtin';
import cloudSync, { cloudSyncSection } from '~/sync/builtin';
import updater, { updatesSection } from '~/updates/builtin';
import themes, { designSection } from '~/themes/builtin';
import toasts, { toastsSection } from '~/toasts/builtin';
import discordSupport from '~/builtins/discord-support';
import type { BuiltInEntry } from '~/builtins/registry';
import type { SectionEntry } from '~/settings/section';
import errorBoundary from '~/builtins/error-boundary';
import coreCommands from '~/commands/core-commands';
import { pluginsSection } from '~/plugins/builtin';
import { assetsSection } from '~/assets/builtin';
import { builtins } from '~/builtins/registry';
import hotRefresh from '~/hot-refresh/builtin';
import staffMode from '~/builtins/staff-mode';
import nativeConsent from '~/native/builtin';
import { Manager } from '~/addons/manager';
import tracking from '~/builtins/tracking';
import commands from '~/commands/builtin';
import debug from '~/debugger/builtin';
import links from '~/links/builtin';
import storage from '~/storage/api';
import * as api from '~/core/api';
import i18n from '~/i18n/builtin';

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

const SECTIONS_IN_OVERVIEW_ORDER: SectionEntry[] = [
	generalSection,
	pluginsSection,
	designSection,
	developerSection,
	marketplaceSection,
	updatesSection,
	toastsSection,
	cloudSyncSection,
	assetsSection,
	panelHostSection,
	storePageSection,
];

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
	['nativeConsent', nativeConsent],
	['settings', createSettings(SECTIONS_IN_OVERVIEW_ORDER)],
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
