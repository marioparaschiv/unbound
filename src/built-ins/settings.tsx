import type { RegisterSettingsEntriesPayload, SettingsEntry } from '@typings/api/settings';
import { CLIENT_NAME, DispatchTypes, SettingsKeys } from '@constants';
import type { CustomScreenProps } from '@typings/built-ins/settings';
import type { BuiltInData } from '@typings/built-ins';
import { findByName, findByProps } from '@api/metro';
import { createLogger } from '@structures/logger';
import { Discord } from '@api/metro/components';
import SourcesPage from '@ui/settings/sources';
import PluginsPage from '@ui/settings/plugins';
import GeneralPage from '@ui/settings/general';
import EventEmitter from '@structures/emitter';
import { Dispatcher } from '@api/metro/common';
import DesignPage from '@ui/settings/design';
import { createPatcher } from '@api/patcher';
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
		[SettingsKeys.General]: {
			type: 'route',
			title: CLIENT_NAME,
			key: SettingsKeys.General,
			parent: null,
			get icon() {
				return Icons['settings'];
			},
			IconComponent: () => <Discord.TableRowIcon IconComponent={Unbound} />,
			screen: {
				route: 'unbound',
				getComponent: () => GeneralPage
			}
		},

		[SettingsKeys.Plugins]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_PLUGINS;
			},
			key: SettingsKeys.Plugins,
			parent: null,
			get icon() {
				return Icons['debug'];
			},
			screen: {
				route: 'unbound/plugins',
				getComponent: () => PluginsPage
			}
		},

		[SettingsKeys.Design]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_DESIGN;
			},
			key: SettingsKeys.Design,
			parent: null,
			get icon() {
				return Icons['ic_theme_24px'];
			},
			screen: {
				route: 'unbound/design',
				getComponent: () => DesignPage
			}
		},

		[SettingsKeys.Sources]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_SOURCES;
			},
			key: SettingsKeys.Sources,
			parent: null,
			icon: Icons['grid'],
			screen: {
				route: 'unbound/sources',
				getComponent: () => SourcesPage
			}
		},

		[SettingsKeys.Custom]: {
			type: 'route',
			title: 'Page',
			key: SettingsKeys.Custom,
			excludeFromDisplay: true,
			parent: null,
			icon: null,
			screen: {
				route: SettingsKeys.Custom,
				getComponent: () => ({ route }: { route: { params: CustomScreenProps; }; }) => {
					const { render: Component, title, ...props } = route.params ?? {};

					const navigation = Discord.useNavigation();
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

	Dispatcher.subscribe(DispatchTypes.REGISTER_SETTINGS_ENTRIES, onRegisterEntry);
}

export function stop() {
	data.unpatches.map(unpatch => unpatch());
	Dispatcher.unsubscribe(DispatchTypes.REGISTER_SETTINGS_ENTRIES, onRegisterEntry);
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