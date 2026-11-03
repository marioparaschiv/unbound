import { storage, ui } from '@unbound-app/api';

import { SETTINGS, type SettingKey } from '~/constants';

const TOGGLES: { key: SettingKey; label: string; subLabel: string }[] = [
	{
		key: 'persistState',
		label: 'Persist State',
		subLabel: 'Keep the toggle on when you open another channel',
	},
	{
		key: 'autoDisable',
		label: 'Auto Disable',
		subLabel: 'Turn the toggle off again after sending one silent message',
	},
];

function SettingsPanel() {
	const settings = storage.useBucket('unbound.silent-message-toggle');

	return (
		<ui.Page>
			<ui.Section title='Toggle'>
				{TOGGLES.map(({ key, label, subLabel }) => (
					<ui.SwitchRow
						key={key}
						label={label}
						subLabel={subLabel}
						value={settings.get(key, SETTINGS[key])}
						onValueChange={(value) => settings.set(key, value)}
					/>
				))}
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
