import { storage, ui } from '@unbound-app/api';

import { SETTINGS, type SettingKey } from '~/constants';

type Toggle = {
	key: SettingKey;
	label: string;
	subLabel: string;
};

const SECTIONS: { title: string; toggles: Toggle[] }[] = [
	{
		title: 'Profiles',
		toggles: [
			{ key: 'avatars', label: 'Avatars', subLabel: 'Animated avatars and profile banners' },
			{
				key: 'decorations',
				label: 'Avatar Decorations',
				subLabel: 'Decorations around avatars',
			},
			{
				key: 'nameplates',
				label: 'Nameplates',
				subLabel: 'Nameplates behind names, on a loop',
			},
			{
				key: 'profileEffects',
				label: 'Profile Effects',
				subLabel: 'Effects on top of profiles',
			},
		],
	},
	{
		title: 'Servers',
		toggles: [
			{
				key: 'servers',
				label: 'Server Icons',
				subLabel: 'Animated server icons and banners',
			},
		],
	},
	{
		title: 'Expressions',
		toggles: [
			{
				key: 'emojis',
				label: 'Emojis',
				subLabel: 'Emojis in messages, reactions and custom statuses',
			},
			{ key: 'stickers', label: 'Stickers', subLabel: 'Animated stickers, on a loop' },
			{ key: 'gifs', label: 'GIFs', subLabel: 'GIFs play without tapping them' },
		],
	},
];

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			{SECTIONS.map(({ title, toggles }) => (
				<ui.Section key={title} title={title}>
					{toggles.map(({ key, label, subLabel }) => (
						<ui.SwitchRow
							key={key}
							label={label}
							subLabel={subLabel}
							value={settings.get(key, SETTINGS[key])}
							onValueChange={(value) => settings.set(key, value)}
						/>
					))}
				</ui.Section>
			))}
		</ui.Page>
	);
}

export default SettingsPanel;
