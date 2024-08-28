import { createPatcher } from '@patcher';
import { findByProps } from '@api/metro';
import { Strings } from '@api/i18n';
import { memo } from 'react';

export const settingSections = [];

class Settings {
	public patcher = createPatcher('unbound-settings');

	private Constants = findByProps('SETTING_RENDERER_CONFIG', { lazy: true });
	private Settings = findByProps('SearchableSettingsList', { lazy: true });
	private SearchQuery = findByProps('getSettingSearchQuery', { lazy: true });
	private SearchResults = findByProps('useSettingSearchResults', { lazy: true });
	private Getters = findByProps('getSettingListSearchResultItems', { lazy: true });

	private patchConstants() {
		this.Constants._SETTING_RENDERER_CONFIG = { ...this.Constants.SETTING_RENDERER_CONFIG };

		settingSections.map(({ entries }) => {
			Object.assign(
				this.Constants.SETTING_RENDERER_CONFIG,
				entries.map(({ id, title, icon, screen, ...rest }) => ({
					[id]: {
						type: 'route',

						get title() {
							const maybeTitle = Strings[title];
							return maybeTitle !== '' ? maybeTitle : title;
						},

						icon,
						parent: null,
						screen: {
							route: id,
							getComponent: () => memo(({ route }: any) => {
								const Screen = screen;
								return <Screen {...route?.params ?? {}} />;
							})
						},
						...rest
					}
				})).reduce((acc, obj) => ({ ...acc, ...obj }), {})
			);
		});
	};

	private patchSections() {
		this.patcher.before(this.Settings.SearchableSettingsList, 'type', (_, [{ sections }]: [{ sections: any[]; }]) => {
			for (const { label, entries } of settingSections) {
				if (!sections.find(section => section.label === label)) {
					const mappable = entries.filter(entry => entry.mappable ?? true).map(entry => entry.id);

					sections.splice(0, 0, { label, settings: mappable });
				}
			}

			const support = sections.find(section => section.label === Strings.SUPPORT);
			support && (support.settings = support.settings.filter(setting => setting !== 'UPLOAD_DEBUG_LOGS'));
		});
	};

	private patchSearch() {
		this.patcher.after(this.SearchResults, 'useSettingSearchResults', (_, __, res) => {
			const query = this.SearchQuery.getSettingSearchQuery().toLowerCase();

			for (const { label, entries } of settingSections) {
				res = res.filter(result => !entries.map(entry => entry.id).includes(result));

				const mappable = entries.filter(entry => entry.mappable ?? true);

				for (const entry of mappable) {
					// By default, the label and the title of the entry are already keywords
					const queryContainsKeyword = [
						...(entry.keywords ?? []),
						label,
						entry.title
					].some(keyword => keyword.toLowerCase().includes(query));

					if (queryContainsKeyword && !res.find(result => result === entry.id)) {
						res.unshift(entry.id);
					}
				}
			}

			return res;
		});

		this.patcher.after(this.Getters, 'getSettingListSearchResultItems', (_, [settings]: string[], res) => {
			for (const { label, entries } of settingSections) {
				const entryIds = entries.map(entry => entry.id);
				res = res.filter(item => !entryIds.includes(item.setting));

				for (const { id, title, icon } of [...entries].reverse()) {
					if (!settings.includes(id)) continue;

					// Normal object getters just crash.
					// This needs a proxy for i18n otherwise it doesn't work..?
					const resultItem = new Proxy({
						title,
						type: 'setting_search_result',
						searchResultData: this.Constants.SETTING_RENDERER_CONFIG[id],
						setting: id,
						breadcrumbs: [label],
						icon
					}, {
						get(target, prop) {
							if (prop === 'title') {
								const maybeTitle = Strings[title];
								return maybeTitle !== '' ? maybeTitle : title;
							}

							return target[prop];
						}
					});

					res.unshift(resultItem);

					for (let i = 0; i < res.length; i++) {
						const entry = res[i];

						entry.index = i;
						entry.total = res.length;
					}
				}
			}

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

export const instance = new Settings();
export const apply = instance.apply.bind(instance);
export const remove = instance.remove.bind(instance);