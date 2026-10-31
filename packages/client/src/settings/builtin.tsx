import type { SettingsScreen, SettingsEntry } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import { useState, useEffect } from 'react';

import { findByProps, findByName, findByFilePath } from '~/metro/search';
import { Screens, CLIENT_NAME } from '~/core/constants';
import { useUnboundSettings } from '~/settings/unbound';
import MarketplacePage from '~/ui/settings/marketplace';
import CloudSyncPage from '~/ui/settings/cloud-sync';
import DeveloperPage from '~/ui/settings/developer';
import CustomScreen from '~/ui/settings/custom';
import GeneralPage from '~/ui/settings/general';
import PluginsPage from '~/ui/settings/plugins';
import UpdatesPage from '~/ui/settings/updates';
import { createPatcher } from '~/patcher/api';
import AssetsPage from '~/ui/settings/assets';
import DesignPage from '~/ui/settings/design';
import ToastsPage from '~/ui/settings/toasts';
import { Discord } from '~/metro/components';
import SettingsStore from '~/settings/state';
import { getIdByName } from '~/assets/api';
import { messages } from '~/i18n/api';

import findSettingsOverview from './find-overview';

const Patcher = createPatcher('unbound::settings');
const Logger = createLogger('Core', 'Settings');

const unpatches: Array<() => void> = [];

type RouteOptions = {
	key: string;
	useTitle: () => string;
	getComponent: SettingsScreen['getComponent'];
	usePredicate?: () => boolean;
	icon?: string;
	hidden?: boolean;
};

/** A section of Discord's settings overview: a label and the route keys listed under it. */
type SettingsSection = {
	label: string;
	settings: string[];
};

/**
 * @description Builds a settings route entry in Discord's `SETTING_RENDERER_CONFIG` shape.
 * @param options The route's key, title hook, component, and optional icon/visibility.
 * @returns A {@link SettingsEntry} ready to register.
 */
function route({
	key,
	useTitle,
	getComponent,
	usePredicate,
	icon,
	hidden,
}: RouteOptions): SettingsEntry {
	return {
		type: 'route',
		key,
		useTitle,
		usePredicate,
		parent: null,
		section: hidden ? undefined : CLIENT_NAME,
		excludeFromDisplay: hidden,
		IconComponent: icon ? () => <Discord.TableRowIcon source={getIdByName(icon)} /> : undefined,
		screen: { route: key, getComponent },
	};
}

/** The built-in Unbound settings entries, keyed by route. */
const builtInEntries: Record<string, SettingsEntry> = {
	[Screens.General]: route({
		key: Screens.General,
		useTitle: () => messages.UNBOUND_GENERAL,
		getComponent: () => GeneralPage,
		icon: 'SettingsIcon',
	}),
	[Screens.Plugins]: route({
		key: Screens.Plugins,
		useTitle: () => messages.UNBOUND_PLUGINS,
		getComponent: () => PluginsPage,
		icon: 'PuzzlePieceIcon',
	}),
	[Screens.Design]: route({
		key: Screens.Design,
		useTitle: () => messages.UNBOUND_DESIGN,
		getComponent: () => DesignPage,
		icon: 'PaintPaletteIcon',
	}),
	[Screens.Developer]: route({
		key: Screens.Developer,
		useTitle: () => messages.UNBOUND_DEVELOPER,
		getComponent: () => DeveloperPage,
		usePredicate: () =>
			useUnboundSettings(({ key }) => key === 'developer-mode').get('developer-mode'),
		icon: 'WrenchIcon',
	}),
	[Screens.Marketplace]: route({
		key: Screens.Marketplace,
		useTitle: () => messages.UNBOUND_MARKETPLACE,
		getComponent: () => MarketplacePage,
		icon: 'img_collectibles_shop',
	}),
	[Screens.Updates]: route({
		key: Screens.Updates,
		useTitle: () => messages.UNBOUND_UPDATES,
		getComponent: () => UpdatesPage,
		icon: 'DownloadIcon',
	}),
	[Screens.Toasts]: route({
		key: Screens.Toasts,
		useTitle: () => messages.UNBOUND_TOAST_SETTINGS,
		getComponent: () => ToastsPage,
		hidden: true,
	}),
	[Screens.CloudSync]: route({
		key: Screens.CloudSync,
		useTitle: () => messages.UNBOUND_CLOUD_SYNC,
		getComponent: () => CloudSyncPage,
		icon: 'CloudIcon',
	}),
	[Screens.Assets]: route({
		key: Screens.Assets,
		useTitle: () => messages.UNBOUND_ASSET_BROWSER,
		getComponent: () => AssetsPage,
		hidden: true,
	}),
	[Screens.Custom]: route({
		key: Screens.Custom,
		useTitle: () => messages.UNBOUND_CUSTOM,
		getComponent: () => CustomScreen,
		hidden: true,
	}),
};

/** Merges the built-in entries with any registered via the public API. */
function allEntries(): Record<string, SettingsEntry> {
	return { ...builtInEntries, ...SettingsStore.getState().sections };
}

/** Adds Unbound's settings routes and its section to Discord's settings overview. */
export function start() {
	patchRendererConfig();
	patchOverview();
}

/** Removes Unbound's settings routes and section. */
export function stop() {
	unpatches.splice(0).map((unpatch) => unpatch());
	Patcher.unpatchAll();
}

function patchRendererConfig() {
	const module = findByProps('SETTING_RENDERER_CONFIG');

	if (!module) {
		return Logger.error('Failed to find SETTING_RENDERER_CONFIG.');
	}

	const original = module.SETTING_RENDERER_CONFIG;
	let current = original;

	Object.defineProperty(module, 'SETTING_RENDERER_CONFIG', {
		configurable: true,
		set: (value) => {
			current = value;
		},
		get: () => ({ ...current, ...allEntries() }),
	});

	unpatches.push(() => {
		Object.defineProperty(module, 'SETTING_RENDERER_CONFIG', {
			configurable: true,
			writable: true,
			value: original,
		});
	});
}

function patchOverview() {
	const Overview = findSettingsOverview(findByName, findByFilePath);

	if (!Overview) {
		return Logger.error('Failed to find SettingsOverviewScreen.');
	}

	Patcher.after(Overview, 'default', ({ result }) => {
		const [, forceUpdate] = useState({});

		useEffect(() => {
			const unsubscribe = SettingsStore.subscribe(() => forceUpdate({}));

			return () => unsubscribe();
		}, []);

		const node = result?.props?.node;

		if (!node || !Array.isArray(node.sections)) {
			return result;
		}

		const keys = Object.values(allEntries())
			.filter((entry) => !entry.excludeFromDisplay)
			.map((entry) => entry.key);

		// Rebuild from the native sections only (dropping any Unbound section a prior render of this
		// same memoised node already prepended) so re-renders don't stack duplicate sections.
		const native = node.sections.filter(
			(section: SettingsSection) => section.label !== CLIENT_NAME,
		);

		node.sections = [{ label: CLIENT_NAME, settings: keys }, ...native];

		return result;
	});
}

export default { start, stop };
