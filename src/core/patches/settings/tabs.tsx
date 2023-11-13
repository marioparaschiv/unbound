import { Icons } from '@api/assets';
import { byProps } from '@metro/filters';
import { findByProps, bulk } from '@metro';
import { ClientName, Keys } from '@constants';
import { React, i18n } from '@metro/common';

import { Settings } from './base';

export class TabsSettings extends Settings {
	private Constants: Record<string, any>;
	private Settings: Record<string, any>;

	constructor() {
		super('tabs');

		const [
			Constants,
			Settings
		] = bulk(
			{ filter: byProps('SETTING_RENDERER_CONFIG'), lazy: true },
			{ filter: byProps('SearchableSettingsList'), lazy: true }
		);

		this.Constants = Constants;
		this.Settings = Settings;
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

			!sections.find(section => section.label === ClientName)
				&& sections.splice(index === -1 ? 1 : index + 1, 0, {
					label: ClientName,
					settings: Object.keys(Keys).filter(key => this.Mappables[key]).map(key => Keys[key])
				});

			const support = sections.find(section => section.label === i18n.Messages.SUPPORT);
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
				const queryContainsKeyword = [ClientName, this.Titles[key]].some(keyword =>
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
					})
				};
			});

			return res;
		});
	};

	public override Icons = {
		General: Icons['settings'],
		Plugins: Icons['ic_activity_24px'],
		Design: Icons['ic_paint_brush'],
		Updater: Icons['ic_download_24px'],
		Custom: null
	};

	public override apply() {
		this.patchConstants();
		this.patchSections();
		this.patchSearch();
	}

	public override remove() {
		this.patcher.unpatchAll();

		this.Constants.SETTING_RENDERER_CONFIG = { ...this.Constants._SETTING_RENDERER_CONFIG };
		delete this.Constants._SETTING_RENDERER_CONFIG;
	}
}