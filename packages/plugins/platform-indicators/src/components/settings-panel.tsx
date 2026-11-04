import { storage, ui } from '@unbound-app/api';

import { SETTINGS, type SettingKey } from '~/constants';

type Toggle = {
	key: SettingKey;
	label: string;
	subLabel: string;
};

const SECTIONS: { title: string; toggles: Toggle[] }[] = [
	{
		title: 'Show Indicators',
		toggles: [
			{
				key: 'memberList',
				label: 'Member List',
				subLabel: 'After names in the member list and other user lists',
			},
			{
				key: 'profiles',
				label: 'Profiles',
				subLabel: 'Under the name and badges on profiles',
			},
			{ key: 'messages', label: 'Messages', subLabel: 'After the timestamp on messages' },
		],
	},
	{
		title: 'Status',
		toggles: [
			{
				key: 'colorMobileIndicator',
				label: 'Color Mobile Indicator',
				subLabel: 'Show the phone status shape for mobile users who are idle or busy too',
			},
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
