import '~/metro/state';
import '~/metro/cache';
import '~/metro';

import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import themes, {
	designSection,
	fontAxesSection,
	fontGroupSection,
	themeColorsSection,
	themeEditorSection,
} from '~/themes/builtin';
import { createSettings, generalSection, panelHostSection } from '~/settings/builtin';
import { marketplaceSection, addonPageSection } from '~/marketplace/builtin';
import gatewayReconnect from '~/builtins/gateway-reconnect';
import updater, { updatesSection } from '~/updates/builtin';
import { developerSection } from '~/settings/builtin.dev';
import { themes as themeManager } from '~/themes/manager';
import { benchMark, benchSpan } from '~/core/bench-span';
import toasts, { toastsSection } from '~/toasts/builtin';
import discordSupport from '~/builtins/discord-support';
import type { BuiltInEntry } from '~/builtins/registry';
import type { SectionEntry } from '~/settings/section';
import errorBoundary from '~/builtins/error-boundary';
import profileExpiry from '~/builtins/profile-expiry';
import sponsorBadges from '~/builtins/sponsor-badges';
import promiseRejections from '~/diagnostics/builtin';
import { assetsSection } from '~/assets/builtin.dev';
import coreCommands from '~/commands/core-commands';
import hotRefresh from '~/hot-refresh/builtin.dev';
import { pluginsSection } from '~/plugins/builtin';
import sync, { syncSection } from '~/sync/builtin';
import { builtins } from '~/builtins/registry';
import staffMode from '~/builtins/staff-mode';
import { icons } from '~/icon-packs/manager';
import nativeConsent from '~/native/builtin';
import { plugins } from '~/plugins/manager';
import { Manager } from '~/addons/manager';
import appIcons from '~/app-icons/builtin';
import tracking from '~/builtins/tracking';
import debug from '~/debugger/builtin.dev';
import commands from '~/commands/builtin';
import account from '~/account/builtin';
import { fonts } from '~/fonts/manager';
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
	syncSection,
	...(import.meta.env.DEV_TOOLS ? [assetsSection] : []),
	panelHostSection,
	addonPageSection,
	fontGroupSection,
	fontAxesSection,
	themeEditorSection,
	themeColorsSection,
];

// The account starts first, so its session refresh is already in flight when other built-ins reach unbound.rip.
const BUILT_INS: BuiltInEntry[] = [
	['account', account],
	['sync', sync],
	['commands', commands],
	['coreCommands', coreCommands],
	['discordSupport', discordSupport],
	['profileExpiry', profileExpiry],
	['errorBoundary', errorBoundary],
	// Developer tooling ships only in the dev bundle; the hot refresh client also needs a local dev build.
	...(import.meta.env.DEV_TOOLS ? ([['debug', debug]] as BuiltInEntry[]) : []),
	...(import.meta.env.DEV ? ([['hotRefresh', hotRefresh]] as BuiltInEntry[]) : []),
	['gatewayReconnect', gatewayReconnect],
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
 * @description Brings up the client: registers the addon managers, starts the built-ins, loads each kind's addons,
 * then runs the built-ins' `afterAddons` hooks. Twin of {@link shutdown}.
 */
export function initialize(): void {
	if (initialized) {
		Logger.warn('Unbound already initialized');

		return;
	}

	benchMark('initialize:start');

	window.unbound = { ...api, initialize, shutdown };
	Logger.info('Initializing Unbound...');

	Manager.register({ plugin: plugins, theme: themeManager, 'icon-pack': icons, font: fonts });
	builtins.initialize(BUILT_INS);

	for (const kind of ADDON_KINDS) {
		benchSpan(`manager ${kind}`, () => Manager.for(kind).initialize());
	}

	builtins.afterAddons();

	initialized = true;
	Logger.info('Unbound initialized');

	benchMark('initialize:end');
}

/**
 * @description Tears the client back down: stops the built-ins, shuts down each kind's manager, persists settings,
 * unregisters the managers and clears the global down to the lifecycle entry points. Twin of {@link initialize}.
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
	Manager.unregister();

	initialized = false;

	window.unbound = {
		initialize,
		shutdown,
	};

	Logger.info('Unbound shutdown complete');
}

initialize();

export default api;
