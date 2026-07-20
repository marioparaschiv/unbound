import type { SettingsEntry } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { createPatcher } from 'possess';

import MarketplacePage from '~/ui/settings/marketplace';
import { Screens, CLIENT_NAME } from '~/lib/constants';
import { findByProps, findByName } from '~/api/metro';
import DeveloperPage from '~/ui/settings/developer';
import { Discord } from '~/api/metro/components';
import CustomScreen from '~/ui/settings/custom';
import GeneralPage from '~/ui/settings/general';
import PluginsPage from '~/ui/settings/plugins';
import SettingsStore from '~/stores/settings';
import AssetsPage from '~/ui/settings/assets';
import DesignPage from '~/ui/settings/design';
import ToastsPage from '~/ui/settings/toasts';
import { getIDByName } from '~/api/assets';
import { getStore } from '~/api/storage';
import { Messages } from '~/api/i18n';

const Patcher = createPatcher('unbound::settings');
const Logger = createLogger('Core', 'Settings');
const Storage = getStore('unbound');

const unpatches: Array<() => void> = [];

type RouteOptions = {
	key: string;
	useTitle: () => string;
	getComponent: () => ComponentType<any>;
	usePredicate?: () => boolean;
	icon?: string;
	hidden?: boolean;
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
		IconComponent: icon ? () => <Discord.TableRowIcon source={getIDByName(icon)} /> : undefined,
		screen: { route: key, getComponent },
	};
}

/** The built-in Unbound settings entries, keyed by route. */
const builtInEntries: Record<string, SettingsEntry> = {
	[Screens.General]: route({
		key: Screens.General,
		useTitle: () => Messages.UNBOUND_GENERAL,
		getComponent: () => GeneralPage,
		icon: 'SettingsIcon',
	}),
	[Screens.Plugins]: route({
		key: Screens.Plugins,
		useTitle: () => Messages.UNBOUND_PLUGINS,
		getComponent: () => PluginsPage,
		icon: 'PuzzlePieceIcon',
	}),
	[Screens.Design]: route({
		key: Screens.Design,
		useTitle: () => Messages.UNBOUND_DESIGN,
		getComponent: () => DesignPage,
		icon: 'PaintPaletteIcon',
	}),
	[Screens.Developer]: route({
		key: Screens.Developer,
		useTitle: () => Messages.UNBOUND_DEVELOPER,
		getComponent: () => DeveloperPage,
		usePredicate: () =>
			Storage.useSettingsStore(({ key }) => key === 'developer-mode').get(
				'developer-mode',
				false,
			),
		icon: 'WrenchIcon',
	}),
	[Screens.Marketplace]: route({
		key: Screens.Marketplace,
		useTitle: () => Messages.UNBOUND_MARKETPLACE,
		getComponent: () => MarketplacePage,
		icon: 'img_collectibles_shop',
	}),
	[Screens.Toasts]: route({
		key: Screens.Toasts,
		useTitle: () => Messages.UNBOUND_TOAST_SETTINGS,
		getComponent: () => ToastsPage,
		hidden: true,
	}),
	[Screens.Assets]: route({
		key: Screens.Assets,
		useTitle: () => Messages.UNBOUND_ASSET_BROWSER,
		getComponent: () => AssetsPage,
		hidden: true,
	}),
	[Screens.Custom]: route({
		key: Screens.Custom,
		useTitle: () => Messages.UNBOUND_CUSTOM,
		getComponent: () => CustomScreen,
		hidden: true,
	}),
};

/** Merges the built-in entries with any registered via the public API. */
function allEntries(): Record<string, SettingsEntry> {
	return { ...builtInEntries, ...SettingsStore.getState().sections };
}

export function start() {
	patchRendererConfig();
	patchOverview();
}

export function stop() {
	unpatches.splice(0).map((unpatch) => unpatch());
	Patcher.unpatchAll();
}

function patchRendererConfig() {
	const module = findByProps('SETTING_RENDERER_CONFIG');
	if (!module) return Logger.error('Failed to find SETTING_RENDERER_CONFIG.');

	const original = module.SETTING_RENDERER_CONFIG;
	let current = original;

	Object.defineProperty(module, 'SETTING_RENDERER_CONFIG', {
		configurable: true,
		set: (value) => (current = value),
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
	const Overview = findByName('SettingsOverviewScreen', { interop: false });
	if (!Overview) return Logger.error('Failed to find SettingsOverviewScreen.');

	Patcher.after(Overview, 'default', ({ result }) => {
		const [, forceUpdate] = useState({});

		useEffect(() => {
			const unsubscribe = SettingsStore.subscribe(() => forceUpdate({}));
			return () => unsubscribe();
		}, []);

		const node = result?.props?.node;
		if (!node || !Array.isArray(node.sections)) return result;

		const keys = Object.values(allEntries())
			.filter((entry) => !entry.excludeFromDisplay)
			.map((entry) => entry.key);

		// Rebuild from the native sections only (dropping any Unbound section a prior render of this
		// same memoised node already prepended) so re-renders don't stack duplicate sections.
		const native = node.sections.filter((section: any) => section.label !== CLIENT_NAME);
		node.sections = [{ label: CLIENT_NAME, settings: keys }, ...native];

		return result;
	});
}

export default { start, stop };
