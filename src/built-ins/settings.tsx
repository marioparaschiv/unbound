import type { RegisterSettingsEntriesPayload, SettingsEntry } from '@typings/api/settings';
import { CLIENT_NAME, DispatchTypes, Screens } from '@constants';
import MarketplacePage from '@ui/settings/marketplace';
import type { BuiltInData } from '@typings/built-ins';
import { findByName, findByProps } from '@api/metro';
import DeveloperPage from '@ui/settings/developer';
import { createLogger } from '@structures/logger';
import { Discord } from '@api/metro/components';
import PluginsPage from '@ui/settings/plugins';
import GeneralPage from '@ui/settings/general';
import EventEmitter from '@structures/emitter';
import CustomScreen from '@ui/settings/custom';
import { Dispatcher } from '@api/metro/common';
import ToastsPage from '@ui/settings/toasts';
import DesignPage from '@ui/settings/design';
import AssetsPage from '@ui/settings/assets';
import { createPatcher } from '@api/patcher';
import { useEffect, useState } from 'react';
import LogsPage from '@ui/settings/logs';
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
		[Screens.General]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_GENERAL;
			},
			key: Screens.General,
			parent: null,
			section: CLIENT_NAME,
			IconComponent: () => <Discord.TableRowIcon source={Icons['ic_cog_24px']} />,
			screen: {
				route: Screens.General,
				getComponent: () => GeneralPage
			}
		},

		[Screens.Plugins]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_PLUGINS;
			},
			key: Screens.Plugins,
			parent: null,
			section: CLIENT_NAME,
			IconComponent: () => <Discord.TableRowIcon source={Icons['debug']} />,
			screen: {
				route: Screens.Plugins,
				getComponent: () => PluginsPage
			}
		},

		[Screens.Design]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_DESIGN;
			},
			key: Screens.Design,
			parent: null,
			section: CLIENT_NAME,
			IconComponent: () => <Discord.TableRowIcon source={Icons['PaintPaletteIcon']} />,
			screen: {
				route: Screens.Design,
				getComponent: () => DesignPage
			}
		},

		[Screens.Marketplace]: {
			type: 'route',
			get title() {
				return Strings.UNBOUND_MARKETPLACE;
			},
			key: Screens.Marketplace,
			parent: null,
			section: CLIENT_NAME,
			IconComponent: () => <Discord.TableRowIcon source={Icons['img_collectibles_shop']} />,
			screen: {
				route: Screens.Marketplace,
				getComponent: () => MarketplacePage
			}
		},

		[Screens.Developer]: {
			type: 'route',
			excludeFromDisplay: true,
			get title() {
				return Strings.UNBOUND_DEVELOPER_SETTINGS;
			},
			key: Screens.Developer,
			parent: null,
			section: CLIENT_NAME,
			screen: {
				route: Screens.Developer,
				getComponent: () => DeveloperPage
			}
		},

		[Screens.Toasts]: {
			type: 'route',
			excludeFromDisplay: true,
			get title() {
				return Strings.UNBOUND_TOAST_SETTINGS;
			},
			key: Screens.Toasts,
			parent: null,
			section: CLIENT_NAME,
			screen: {
				route: Screens.Toasts,
				getComponent: () => ToastsPage
			}
		},

		[Screens.Logs]: {
			type: 'route',
			excludeFromDisplay: true,
			get title() {
				return Strings.UNBOUND_DEBUG_LOGS;
			},
			key: Screens.Logs,
			parent: null,
			section: CLIENT_NAME,
			screen: {
				route: Screens.Logs,
				getComponent: () => LogsPage
			}
		},

		[Screens.Assets]: {
			type: 'route',
			excludeFromDisplay: true,
			get title() {
				return Strings.UNBOUND_ASSET_BROWSER;
			},
			key: Screens.Assets,
			parent: null,
			section: CLIENT_NAME,
			screen: {
				route: Screens.Assets,
				getComponent: () => AssetsPage
			}
		},

		[Screens.Custom]: {
			type: 'route',
			title: 'Page',
			key: Screens.Custom,
			excludeFromDisplay: true,
			parent: null,
			icon: null,
			screen: {
				route: Screens.Custom,
				getComponent: () => CustomScreen
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