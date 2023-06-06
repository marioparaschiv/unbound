import { Settings } from './base';
import { Icons } from '@api/assets';
import { byName, byProps } from '@metro/filters';
import { bulk } from '@metro';
import { ClientName, Keys } from '@constants';
import { findInReactTree } from '@utilities';
import { i18n } from '@metro/common';
import { findByProps } from '@metro';

export class TabsSettings extends Settings {
    private Config: Record<string, any>;
    private Settings: { default: any };

    constructor() {
        super('tabs');

        const [
            Config,
            Settings
        ] = bulk(
            { filter: byProps('SETTING_RENDERER_CONFIGS', 'SETTING_RELATIONSHIPS'), lazy: true },
            { filter: byName('SettingsOverviewScreen'), interop: false }
        );

        this.Config = Config;
        this.Settings = Settings;
    };

    private patchConstants() {
        this.Config._SETTING_RENDERER_CONFIGS = this.Config.SETTING_RENDERER_CONFIGS;
        this.Config._SETTING_RELATIONSHIPS = this.Config.SETTING_RELATIONSHIPS;

        Object.assign(
            this.Config.SETTING_RENDERER_CONFIGS,
            Object.keys(Keys).map(key => ({
                [Keys[key]]: {
                    type: 'route',
                    icon: this.Icons[key],
                    screen: {
                        route: Keys[key],
                        getComponent: () => ({ route }) => {
                            const Screen = this.Screens[key];

                            return <Screen {...route?.params ?? {}} />;
                        }
                    }
                }
            })).reduce((acc, obj) => ({ ...acc, ...obj }), {})
        );

        Object.assign(
            this.Config.SETTING_RELATIONSHIPS,
            Object.keys(Keys)
                .map(key => ({ [Keys[key]]: this.Relationships[key] }))
                .reduce((acc, obj) => ({ ...acc, ...obj }), {})
       );
    };

    private patchSections() {
        this.patcher.after(this.Settings, 'default', (_, __, res) => {
            const { sections } = findInReactTree(res, r => r.sections);
            const index = sections?.findIndex(section => section.settings.find(setting => setting === 'ACCOUNT'));

            !sections.find(section => section.title === ClientName) &&
                sections.splice(index === -1 ? 1 : index + 1, 0, {
                    title: ClientName,
                    settings: Object.keys(Keys).filter(key => this.Mappables[key]).map(key => Keys[key])
                });

            const support = sections.find(section => section.title === i18n.Messages.SUPPORT);
            support && (support.settings = support.settings.filter(setting => setting !== 'UPLOAD_DEBUG_LOGS'));
        });
    };

    private patchSearch() {
        const [
            Search,
            Getters
        ] = findByProps(
            { params: ['useSettingSearch'] },
            { params: ['getSettingSearchListItems'] },
            { bulk: true }
        )


        this.patcher.after(Search, 'useSettingSearch', (_, __, res) => {
            res.results = res.results.filter(result => !Object.values(Keys).includes(result));

            Object.keys(Keys).filter(key => this.Mappables[key]).forEach(key => {
                if ([Keys.General, this.Titles[key]].some(keyword => keyword.toLowerCase().includes(res.text.toLowerCase()))
                    && !res.results.find(result => result === Keys[key])) res.results.unshift(Keys[key]);
            });
        });

        this.patcher.after(Getters, 'getSettingSearchListItems', (_, [settings], res) => {
            res = res.filter(item => !Object.values(Keys).includes(item.setting));

            Object.keys(Keys).reverse().forEach(key => {
                if (settings.includes(Keys[key])) (
                    res.unshift({
                        type: 'setting_search_result',
                        ancestorRendererData: this.Config.SETTING_RENDERER_CONFIGS[Keys[key]],
                        setting: Keys[key],
                        title: this.Titles[key],
                        breadcrumbs: this.Breadcrumbs[key],
                        icon: this.Icons[key]
                    }),

                    res.forEach((value, index: number, parent) => {
                        value.index = index;
                        value.total = parent.length;
                    })
                );
            })

            return res;
        });
    };

    private patchTitles() {
        this.patcher.after(this.Config, 'getSettingTitleConfig', (_, __, res) => {
            return {
                ...res,
                ...Object.keys(Keys)
                    .map(key => ({ [Keys[key]]: this.Titles[key] }))
                    .reduce((acc, obj) => ({ ...acc, ...obj }), {})
            };
        });
    }

    public override Icons = {
        General: Icons['settings'],
        Plugins: Icons['ic_activity_24px'],
        Themes: Icons['ic_paint_brush'],
        Updater: Icons['ic_download_24px'],
        Custom: null
    }

    public override apply() {
        this.patchConstants();
        this.patchSections();
        this.patchTitles();
        this.patchSearch();
    }

    public override remove() {
        this.patcher.unpatchAll();

        this.Config.SETTING_RENDERER_CONFIGS = this.Config._SETTING_RENDERER_CONFIGS
        this.Config.SETTING_RELATIONSHIPS = this.Config._SETTING_RELATIONSHIPS

        delete this.Config._SETTING_RENDERER_CONFIGS;
        delete this.Config._SETTING_RELATIONSHIPS;
    }
}