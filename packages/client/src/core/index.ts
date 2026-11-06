import '~/metro/state';
import '~/metro/cache';
import '~/metro';

import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import { createSettings, generalSection, panelHostSection } from '~/settings/builtin';
import { marketplaceSection, storePageSection } from '~/marketplace/builtin';
import themes, { designSection, fontGroupSection } from '~/themes/builtin';
import cloudSync, { cloudSyncSection } from '~/sync/builtin';
import updater, { updatesSection } from '~/updates/builtin';
import { developerSection } from '~/settings/builtin.dev';
import toasts, { toastsSection } from '~/toasts/builtin';
import discordSupport from '~/builtins/discord-support';
import type { BuiltInEntry } from '~/builtins/registry';
import type { SectionEntry } from '~/settings/section';
import errorBoundary from '~/builtins/error-boundary';
import sponsorBadges from '~/builtins/sponsor-badges';
import promiseRejections from '~/diagnostics/builtin';
import { assetsSection } from '~/assets/builtin.dev';
import coreCommands from '~/commands/core-commands';
import hotRefresh from '~/hot-refresh/builtin.dev';
import { pluginsSection } from '~/plugins/builtin';
import { builtins } from '~/builtins/registry';
import staffMode from '~/builtins/staff-mode';
import appIcons from '~/app-icons/builtin';
import nativeConsent from '~/native/builtin';
import { Manager } from '~/addons/manager';
import tracking from '~/builtins/tracking';
import debug from '~/debugger/builtin.dev';
import commands from '~/commands/builtin';
import account from '~/account/builtin';
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
	marketplaceSection,
	updatesSection,
	...(import.meta.env.DEV_TOOLS ? [developerSection] : []),
	toastsSection,
	cloudSyncSection,
	...(import.meta.env.DEV_TOOLS ? [assetsSection] : []),
	panelHostSection,
	storePageSection,
	fontGroupSection,
];

// The account starts first: it takes over Sync's session before Sync reads it.
const BUILT_INS: BuiltInEntry[] = [
	['account', account],
	['cloudSync', cloudSync],
	['commands', commands],
	['coreCommands', coreCommands],
	['discordSupport', discordSupport],
	['errorBoundary', errorBoundary],
	// Developer tooling ships only in the dev bundle; the hot refresh client also needs a local dev build.
	...(import.meta.env.DEV_TOOLS ? ([['debug', debug]] as BuiltInEntry[]) : []),
	...(import.meta.env.DEV ? ([['hotRefresh', hotRefresh]] as BuiltInEntry[]) : []),
	['i18n', i18n],
	['links', links],
	['nativeConsent', nativeConsent],
	['promiseRejections', promiseRejections],
	['settings', createSettings(SECTIONS_IN_OVERVIEW_ORDER)],
	['sponsorBadges', sponsorBadges],
	['staffMode', staffMode],
	['appIcons', appIcons],
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
export function initialize(): void {
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
export async function shutdown(): Promise<void> {
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
