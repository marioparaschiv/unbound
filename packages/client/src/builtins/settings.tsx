import type { SettingsEntry } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import { useState, useEffect } from 'react';
import { createPatcher } from 'possess';

import { Screens, CLIENT_NAME } from '~/lib/constants';
import { findByProps, findByName } from '~/api/metro';
import { Discord } from '~/api/metro/components';
import GeneralPage from '~/ui/settings/general';
import SettingsStore from '~/stores/settings';
import { getIDByName } from '~/api/assets';
import { Messages } from '~/api/i18n';

const Patcher = createPatcher('unbound::settings');
const Logger = createLogger('Core', 'Settings');

const unpatches: Array<() => void> = [];

/** The built-in Unbound settings entries, keyed by route. */
const builtInEntries: Record<string, SettingsEntry> = {
	[Screens.General]: {
		type: 'route',
		key: Screens.General,
		useTitle: () => Messages.UNBOUND_GENERAL,
		parent: null,
		section: CLIENT_NAME,
		IconComponent: () => <Discord.TableRowIcon source={getIDByName('SettingsIcon')} />,
		screen: { route: Screens.General, getComponent: () => GeneralPage },
	},
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

		node.sections = [{ label: CLIENT_NAME, settings: keys }, ...node.sections];

		return result;
	});
}

export default { start, stop };
