import type { RegisterSettingsEntriesPayload, SettingsEntry } from '@typings/api/settings';
import { CLIENT_NAME, DISPATCH_TYPES, SETTINGS_KEYS } from '@constants';
import type { CustomScreenProps } from '@typings/built-ins/settings';
import type { BuiltInData } from '@typings/built-ins';
import { findByName, findByProps } from '@api/metro';
import { createLogger } from '@structures/logger';
import { Design } from '@api/metro/components';
import GeneralPage from '@ui/settings/general';
import PluginsPage from '@ui/settings/plugins';
import SourcesPage from '@ui/settings/sources';
import { Dispatcher } from '@api/metro/common';
import EventEmitter from '@structures/emitter';
import { createPatcher } from '@api/patcher';
import DesignPage from '@ui/settings/design';
import { useEffect, useState } from 'react';
import Unbound from '@ui/icons/unbound';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

const Events = new EventEmitter();

const Patcher = createPatcher('unbound::settings');
const Logger = createLogger('Core', 'Settings');

export const data: BuiltInData & {
	entries: {
		[key: PropertyKey]: SettingsEntry;
	};
} = {
	name: 'Settings',
	unpatches: [],
	entries: {
		[SETTINGS_KEYS.General]: {
			type: 'route',
			title: CLIENT_NAME,
			key: SETTINGS_KEYS.General,
			parent: null,
			icon: Icons['settings'],
			IconComponent: () => <Design.TableRowIcon IconComponent={Unbound} />,
			screen: {
				route: 'unbound',
				getComponent: () => GeneralPage
			}
		},

		[SETTINGS_KEYS.Plugins]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_PLUGINS;
			},
			key: SETTINGS_KEYS.Plugins,
			parent: null,
			icon: Icons['debug'],
			screen: {
				route: 'unbound/plugins',
				getComponent: () => PluginsPage
			}
		},

		[SETTINGS_KEYS.Design]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_DESIGN;
			},
			key: SETTINGS_KEYS.Design,
			parent: null,
			icon: Icons['ic_theme_24px'],
			screen: {
				route: 'unbound/design',
				getComponent: () => DesignPage
			}
		},

		[SETTINGS_KEYS.Sources]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_SOURCES;
			},
			key: SETTINGS_KEYS.Sources,
			parent: null,
			icon: Icons['grid'],
			screen: {
				route: 'unbound/sources',
				getComponent: () => SourcesPage
			}
		},

		[SETTINGS_KEYS.Custom]: {
			type: 'route',
			title: 'Page',
			key: SETTINGS_KEYS.Custom,
			excludeFromDisplay: true,
			parent: null,
			icon: null,
			screen: {
				route: SETTINGS_KEYS.Custom,
				getComponent: () => ({ route }: { route: { params: CustomScreenProps; }; }) => {
					const { render: Component, title, ...props } = route.params ?? {};

					const navigation = Design.useNavigation();
					const unsubscribe = navigation.addListener('focus', () => {
						unsubscribe();
						navigation.setOptions({ title });
					});

					return <Component {...props} />;
				}
			}
		}
	},
};

export function start() {
	patchSettingsConfig();
	patchSettingsOverview();

	Dispatcher.subscribe(DISPATCH_TYPES.REGISTER_SETTINGS_ENTRIES, onRegisterEntry);
}

export function stop() {
	data.unpatches.map(unpatch => unpatch());
	Dispatcher.unsubscribe(DISPATCH_TYPES.REGISTER_SETTINGS_ENTRIES, onRegisterEntry);
	Patcher.unpatchAll();
}

function patchSettingsConfig() {
	const SettingsConfig = findByProps('SETTING_RENDERER_CONFIG');
	if (!SettingsConfig) return Logger.error('Failed to find SETTING_RENDERER_CONFIG.');

	SettingsConfig._SETTING_RENDERER_CONFIG = SettingsConfig.SETTING_RENDERER_CONFIG;
	let origRendererConfig = SettingsConfig.SETTING_RENDERER_CONFIG;

	Object.defineProperty(SettingsConfig, 'SETTING_RENDERER_CONFIG', {
		set: (value) => origRendererConfig = value,
		get: () => ({ ...origRendererConfig, ...data.entries }),
	});

	data.unpatches.push(() => {
		delete SettingsConfig.SETTING_RENDERER_CONFIG;
		SettingsConfig.SETTING_RENDERER_CONFIG = SettingsConfig._SETTING_RENDERER_CONFIG;
		delete SettingsConfig._SETTING_RENDERER_CONFIG;
	});
}

function patchSettingsOverview() {
	const SettingsOverviewScreen = findByName('SettingsOverviewScreen', { interop: false });
	if (!SettingsOverviewScreen) return Logger.error('Failed to find SettingsOverviewScreen.');

	Patcher.after(SettingsOverviewScreen, 'default', (_, args, res) => {
		const [, forceUpdate] = useState({});

		useEffect(() => {
			function handler() {
				forceUpdate({});
			}

			Events.on('updated-sections', handler);
			return () => Events.off('updated-sections', handler);
		}, []);

		const sections = [...res.props.sections];
		const sectionsMap = new Map();

		sectionsMap.set('unbound-main-section', {
			isUnbound: true,
			isUnboundMainSection: true,
			label: null,
			settings: []
		});

		for (const entry of Object.values(data.entries)) {
			if (entry.excludeFromDisplay) continue;

			if (entry.section) {
				if (!sectionsMap.has(entry.section)) {
					sectionsMap.set(entry.section, {
						isUnbound: true,
						label: entry.section,
						settings: []
					});
				}

				const section = sectionsMap.get(entry.section);

				if (!section.settings.includes(entry.key)) {
					section.settings.push(entry.key);
				}
			} else {
				const section = sectionsMap.get('unbound-main-section');

				if (!section.settings.includes(entry.key)) {
					section.settings.push(entry.key);
				}
			}
		}

		const sortedSections = [...sectionsMap.values()].sort((a, b) => {
			// Our main section must always be at the top
			if (a.isUnboundMainSection) return -1;
			if (b.isUnboundMainSection) return 1;
			return a.label.localeCompare(b.label);
		});

		sections.unshift(...sortedSections);

		res.props.sections = sections;

		return res;
	});
}

function onRegisterEntry({ entries }: RegisterSettingsEntriesPayload) {
	for (const entry of entries) {
		if (data.entries[entry.key]) {
			Logger.warn(`Overwriting already existing section ${entry.key}. If this was intended, please ignore this.`);
		}

		data.entries[entry.key] = entry;
	}

	Events.emit('updated-sections');
}