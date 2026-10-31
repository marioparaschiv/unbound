import type { SettingsEntry } from '@unbound-app/types';
import { useState, useEffect } from 'react';

import { onModuleLoaded } from '~/metro/wait';
import { byProps } from '~/metro/filters';
import { Screens, CLIENT_NAME } from '~/core/constants';
import { useUnboundSettings } from '~/settings/unbound';
import type { SectionEntry } from '~/settings/section';
import DeveloperPage from '~/ui/settings/developer';
import type { BuiltIn } from '~/builtins/registry';
import PanelHostScreen from '~/ui/settings/custom';
import GeneralPage from '~/ui/settings/general';
import { createPatcher } from '~/patcher/api';
import { Discord } from '~/metro/components';
import SettingsStore from '~/settings/state';
import { getIdByName } from '~/assets/api';
import { messages } from '~/i18n/api';

import waitForSettingsOverview from './wait-for-overview';

const Patcher = createPatcher('unbound::settings');

const unpatches: Array<() => void> = [];

/** A section of Discord's settings overview: a label and the route keys listed under it. */
type SettingsSection = {
	label: string;
	settings: string[];
};

type EntryMap = Record<string, SettingsEntry>;

function useDeveloperMode(): boolean {
	return useUnboundSettings(({ key }) => key === 'developer-mode').get('developer-mode');
}

export const generalSection: SectionEntry = {
	key: Screens.General,
	titleKey: 'UNBOUND_GENERAL',
	component: GeneralPage,
	icon: 'SettingsIcon',
};

export const developerSection: SectionEntry = {
	key: Screens.Developer,
	titleKey: 'UNBOUND_DEVELOPER',
	component: DeveloperPage,
	usePredicate: useDeveloperMode,
	icon: 'WrenchIcon',
};

export const panelHostSection: SectionEntry = {
	key: Screens.PanelHost,
	titleKey: 'UNBOUND_CUSTOM',
	component: PanelHostScreen,
	hidden: true,
};

/**
 * @description Builds a settings route entry in Discord's `SETTING_RENDERER_CONFIG` shape.
 * @param section The section's key, title key, component, and optional icon/visibility.
 * @returns A {@link SettingsEntry} ready to register.
 */
function route({
	key,
	titleKey,
	component,
	usePredicate,
	icon,
	hidden,
}: SectionEntry): SettingsEntry {
	return {
		type: 'route',
		key,
		useTitle: () => messages[titleKey],
		usePredicate,
		parent: null,
		section: hidden ? undefined : CLIENT_NAME,
		excludeFromDisplay: hidden,
		IconComponent: icon ? () => <Discord.TableRowIcon source={getIdByName(icon)} /> : undefined,
		screen: { route: key, getComponent: () => component },
	};
}

/** Merges the built-in entries with any registered via the public API. */
function allEntries(builtIn: EntryMap): EntryMap {
	return { ...builtIn, ...SettingsStore.getState().sections };
}

/**
 * @description Creates the settings built-in, which lists the given sections first in Discord's settings overview.
 * @param sections Every domain's Settings section, in the order the overview lists them.
 * @returns The built-in that adds the sections' routes and Unbound's overview section.
 */
export function createSettings(sections: SectionEntry[]): BuiltIn {
	const builtIn: EntryMap = Object.fromEntries(
		sections.map((section) => [section.key, route(section)]),
	);

	return {
		start() {
			patchRendererConfig(builtIn);
			patchOverview(builtIn);
		},
		stop,
	};
}

/** Removes Unbound's settings routes and section. */
function stop() {
	unpatches.splice(0).map((unpatch) => unpatch());
	Patcher.unpatchAll();
}

function patchRendererConfig(builtIn: EntryMap) {
	// Redefined as the module loads, before Discord's code that imports it reads the config.
	unpatches.push(
		onModuleLoaded(byProps('SETTING_RENDERER_CONFIG'), (module) =>
			redefineRendererConfig(module, builtIn),
		),
	);
}

function redefineRendererConfig(module: MetroExport, builtIn: EntryMap) {
	const original = module.SETTING_RENDERER_CONFIG;
	let current = original;

	Object.defineProperty(module, 'SETTING_RENDERER_CONFIG', {
		configurable: true,
		set: (value) => {
			current = value;
		},
		get: () => ({ ...current, ...allEntries(builtIn) }),
	});

	unpatches.push(() => {
		Object.defineProperty(module, 'SETTING_RENDERER_CONFIG', {
			configurable: true,
			writable: true,
			value: original,
		});
	});
}

function patchOverview(builtIn: EntryMap) {
	unpatches.push(
		waitForSettingsOverview(onModuleLoaded, (Overview) =>
			patchOverviewScreen(Overview, builtIn),
		),
	);
}

function patchOverviewScreen(Overview: MetroExport, builtIn: EntryMap) {
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

		const keys = Object.values(allEntries(builtIn))
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

export default { generalSection, developerSection, panelHostSection, createSettings };
