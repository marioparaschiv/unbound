import { createPatcher } from '@patcher';
import { fastFindByProps } from '@metro';
import { React } from '@metro/common';
import { Strings } from '@api/i18n';

export const settingSections = [];

class Settings {
	public patcher = createPatcher('unbound-settings');
	private Constants = fastFindByProps('SETTING_RENDERER_CONFIG', { lazy: true });
	private Settings = fastFindByProps('SearchableSettingsList', { lazy: true });
	private SearchQuery = fastFindByProps('getSettingSearchQuery', { lazy: true });
	private SearchResults = fastFindByProps('useSettingSearchResults', { lazy: true });
	private Getters = fastFindByProps('getSettingListSearchResultItems', { lazy: true });

	private patchConstants() {
		this.Constants._SETTING_RENDERER_CONFIG = { ...this.Constants.SETTING_RENDERER_CONFIG };

		settingSections.map(({ entries }) => {
			Object.assign(
				this.Constants.SETTING_RENDERER_CONFIG,
				entries.map(({ id, title, icon, screen }) => ({
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
							getComponent: () => React.memo(({ route }: any) => {
								const Screen = screen;
								return <Screen {...route?.params ?? {}} />;
							})
						}
					}
				})).reduce((acc, obj) => ({ ...acc, ...obj }), {})
			);
		});
	};

	private patchSections() {
		this.patcher.before(this.Settings.SearchableSettingsList, 'type', (_, [{ sections }]: [{ sections: any[] }]) => {
			const index = sections?.findIndex(section => section.settings.find(setting => setting === 'ACCOUNT'));

			settingSections.reverse().forEach(({ label, entries }) => {
				if (!sections.find(section => section.label === label)) {
					sections.splice(index === -1 ? 1 : index + 1, 0, {
						label,
						settings: entries.filter(entry => entry.mappable ?? true).map(entry => entry.id)
					});
				}
			});

			settingSections.reverse();

			const support = sections.find(section => section.label === Strings.SUPPORT);
			support && (support.settings = support.settings.filter(setting => setting !== 'UPLOAD_DEBUG_LOGS'));
		});
	};

	private patchSearch() {
		this.patcher.after(this.SearchResults, 'useSettingSearchResults', (_, __, res) => {
			settingSections.forEach(({ label, entries }) => {
				res = res.filter(result => !entries.map(entry => entry.id).includes(result));

				entries.filter(entry => entry.mappable ?? true).forEach(entry => {
						// By default, the label and the title of the entry are already keywords
						const queryContainsKeyword = [...entry.keywords ?? [], label, entry.title].some(keyword =>
							keyword.toLowerCase().includes(this.SearchQuery.getSettingSearchQuery().toLowerCase()));

						if (queryContainsKeyword && !res.find(result => result === entry.id)) res.unshift(entry.id);
				});
			});

			return res;
		});

		this.patcher.after(this.Getters, 'getSettingListSearchResultItems', (_, [settings]: string[], res) => {
			settingSections.forEach(({ label, entries }) => {
				res = res.filter(item => !entries.map(entry => entry.id).includes(item.setting));

				entries.reverse().forEach(({ id, title, icon }) => {
					if (settings.includes(id)) {
						res.unshift({
							type: 'setting_search_result',
							searchResultData: this.Constants.SETTING_RENDERER_CONFIG[id],
							setting: id,
							title,
							breadcrumbs: [label],
							icon
						});

						res.forEach((value, index: number, parent) => {
							value.index = index;
							value.total = parent.length;
						});
					}
				});

				entries.reverse();
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

export const instance = new Settings();
export const apply = instance.apply.bind(instance);
export const remove = instance.remove.bind(instance);