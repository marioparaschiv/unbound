import { findByName } from '@metro';
import { findInReactTree } from '@utilities';
import { i18n } from '@metro/common';
import { Forms } from '@metro/components';
import { ClientName, Keys } from '@constants';
import { Icons } from '@api/assets';
import * as Icon from '@ui/icons';

import { Settings } from './base';

export class PanelsSettings extends Settings {
	private Settings: { default: any; };
	private Scenes: { default: any; };

	constructor() {
		super('panels');

		const [
			Settings,
			Scenes
		] = findByName(
			{ params: ['UserSettingsOverviewWrapper'], interop: false },
			{ params: ['getScreens'], interop: false },
			{ bulk: true }
		);

		this.Settings = Settings;
		this.Scenes = Scenes;
	};

	private patchWrapper() {
		this.patcher.after(this.Settings, 'default', (_, __, wrapper) => {
			const instance = findInReactTree(wrapper, m => m.type?.name === 'UserSettingsOverview');
			if (!instance) return wrapper;

			this.patchSettings(instance);
		}, true);
	}

	private patchSettings(instance) {
		this.patcher.after(instance.type.prototype, 'render', (self, __, res) => {
			const { navigation } = self.props;
			const { children } = res.props;

			const index = children.findIndex(c => c?.props?.title === i18n.Messages.PREMIUM_SETTINGS_GENERIC);

			children.splice(index, 0, <>
				<Forms.FormSection key={ClientName} title={ClientName}>
					{Object.keys(Keys).filter(key => this.Mappables[key]).map((key, idx, array) => {
						return <>
							<Forms.FormRow
								label={this.Titles[key]}
								leading={this.Icons[key]}
								trailing={<Forms.FormArrow />}
								onPress={() => navigation.push(Keys[key], { ...self.props, ...res.props })}
							/>
							{idx < (array.length - 1) && <Forms.FormDivider />}
						</>;
					})}
				</Forms.FormSection>
			</>);

			// Remove 'Upload Debug Logs' button
			const support = children.find(c => c?.props.title === i18n.Messages.SUPPORT);
			const entries = support?.props.children;

			if (entries) {
				support.props.children = entries.filter(e => e?.type?.name !== 'UploadLogsButton');
			}
		});
	}

	private patchScenes() {
		this.patcher.after(this.Scenes, 'default', (_, __, res) => {
			return {
				...res,
				...Object.keys(Keys)
					.map(key => ({
						[Keys[key]]: {
							key: Keys[key],
							render: this.Screens[key],
							title: this.Titles[key]
						}
					}))
					.reduce((acc, obj) => ({ ...acc, ...obj }), {})
			};
		});
	}

	public override Icons = {
		General: () => <Forms.FormRow.Icon source={Icons['settings']} />,
		Plugins: () => <Icon.Puzzle height={24} width={24} />,
		Themes: () => <Icon.Palette height={24} width={24} />,
		Updater: () => <Forms.FormRow.Icon source={Icons['ic_download_24px']} />,
		Custom: () => null
	};

	public override apply() {
		this.patchWrapper();
		this.patchScenes();
	};

	public override remove() {
		this.patcher.unpatchAll();
	}
}