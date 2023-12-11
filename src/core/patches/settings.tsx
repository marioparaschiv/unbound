import { ClientName, Keys } from '@constants';
import { Redesign } from '@metro/components';
import { findByProps, bulk } from '@metro';
import { byProps } from '@metro/filters';
import { createPatcher } from '@patcher';
import { React } from '@metro/common';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';

import General from '@ui/settings/general';
import Plugins from '@ui/settings/plugins';
import Design from '@ui/settings/design';

type CustomScreenProps = {
	title: string;
	render: React.ComponentType;
};

class Settings {
	public patcher = createPatcher('unbound-settings');
	private Constants: Record<string, any>;
	private Settings: Record<string, any>;

	constructor() {
		const [
			Constants,
			Settings
		] = bulk(
			{ filter: byProps('SETTING_RENDERER_CONFIG'), lazy: true },
			{ filter: byProps('SearchableSettingsList'), lazy: true }
		);

		this.Constants = Constants;
		this.Settings = Settings;
	}


	public Titles = {
		get General() {
			return Strings.SETTINGS;
		},

		get Plugins() {
			return Strings.UNBOUND_PLUGINS;
		},

		get Design() {
			return Strings.UNBOUND_DESIGN;
		},

		get Updater() {
			return Strings.UNBOUND_UPDATER;
		},

		get Custom() {
			return 'Page';
		}
	};

	public Icons = {
		General: Icons['settings'],
		Plugins: Icons['PuzzlePieceIcon'],
		Design: Icons['ic_paint_brush'],
		Updater: Icons['ic_download_24px'],
		Custom: null
	};

	public Breadcrumbs = {
		General: [ClientName],
		Plugins: [ClientName],
		Design: [ClientName],
		Updater: [ClientName],
		Custom: []
	};

	public Keywords = {
		get General() {
			return [Strings.UNBOUND_GENERAL];
		},

		get Plugins() {
			return [];
		},

		get Design() {
			return [Strings.UNBOUND_THEMES, Strings.UNBOUND_ICONS, Strings.UNBOUND_FONTS];
		},

		get Updater() {
			return [];
		},

		get Custom() {
			return [];
		},
	};

	public Mappables = {
		General: true,
		Plugins: true,
		Design: true,
		Updater: true,
		Custom: false
	};

	public Screens = {
		General,
		Plugins,
		Design,
		Updater: () => null,
		Custom: ({ title, render: Component, ...props }: CustomScreenProps) => {
			const navigation = Redesign.useNavigation();

			const unsubscribe = navigation.addListener('focus', () => {
				unsubscribe();
				navigation.setOptions({ title });
			});

			return <Component {...props} />;
		}
	};

	private patchConstants() {
		this.Constants._SETTING_RENDERER_CONFIG = { ...this.Constants.SETTING_RENDERER_CONFIG };

		Object.assign(
			this.Constants.SETTING_RENDERER_CONFIG,
			Object.keys(Keys).map(key => ({
				[Keys[key]]: {
					type: 'route',
					title: () => this.Titles[key],
					icon: this.Icons[key],
					parent: null,
					screen: {
						route: Keys[key],
						getComponent: () => React.memo(({ route }: any) => {
							const Screen = this.Screens[key];
							return <Screen {...route?.params ?? {}} />;
						})
					}
				}
			})).reduce((acc, obj) => ({ ...acc, ...obj }), {})
		);
	};

	private patchSections() {
		this.patcher.before(this.Settings.SearchableSettingsList, 'type', (_, [{ sections }]) => {
			const index = sections?.findIndex(section => section.settings.find(setting => setting === 'ACCOUNT'));

			if (!sections.find(section => section.label === ClientName)) {
				sections.splice(index === -1 ? 1 : index + 1, 0, {
					label: ClientName,
					settings: Object.keys(Keys).filter(key => this.Mappables[key]).map(key => Keys[key])
				});
			}

			const support = sections.find(section => section.label === Strings.SUPPORT);
			support && (support.settings = support.settings.filter(setting => setting !== 'UPLOAD_DEBUG_LOGS'));
		});
	};

	private patchSearch() {
		const [
			SearchQuery,
			SearchResults,
			Getters
		] = findByProps(
			{ params: ['getSettingSearchQuery'] },
			{ params: ['useSettingSearchResults'] },
			{ params: ['getSettingListSearchResultItems'] },
			{ bulk: true }
		);

		this.patcher.after(SearchResults, 'useSettingSearchResults', (_, __, res) => {
			res = res.filter(result => !Object.values(Keys).includes(result));

			Object.keys(Keys).filter(key => this.Mappables[key]).forEach(key => {
				// By default, the client name and the title of the entry are already keywords
				const queryContainsKeyword = [...this.Keywords[key], ClientName, this.Titles[key]].some(keyword =>
					keyword.toLowerCase().includes(SearchQuery.getSettingSearchQuery().toLowerCase()));

				if (queryContainsKeyword && !res.find(result => result === Keys[key])) res.unshift(Keys[key]);
			});

			return res;
		});

		this.patcher.after(Getters, 'getSettingListSearchResultItems', (_, [settings], res) => {
			res = res.filter(item => !Object.values(Keys).includes(item.setting));

			Object.keys(Keys).reverse().forEach(key => {
				if (settings.includes(Keys[key])) {
					res.unshift({
						type: 'setting_search_result',
						searchResultData: this.Constants.SETTING_RENDERER_CONFIG[Keys[key]],
						setting: Keys[key],
						title: this.Titles[key],
						breadcrumbs: this.Breadcrumbs[key],
						icon: this.Icons[key]
					});

					res.forEach((value, index: number, parent) => {
						value.index = index;
						value.total = parent.length;
					});
				};
			});

			return res;
		});
	};

	public apply() {
		this.patchConstants();
		this.patchSections();
		this.patchSearch();
	}

	public remove() {
		this.patcher.unpatchAll();

		this.Constants.SETTING_RENDERER_CONFIG = { ...this.Constants._SETTING_RENDERER_CONFIG };
		delete this.Constants._SETTING_RENDERER_CONFIG;
	}
}

const instance = new Settings();

export const apply = instance.apply.bind(instance);
export const remove = instance.remove.bind(instance);