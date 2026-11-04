import { storage, ui } from '@unbound-app/api';

import { SETTINGS, type BlurPart } from '~/constants';

const TOGGLES: { key: BlurPart; label: string; subLabel: string }[] = [
	{
		key: 'attachments',
		label: 'Attachments',
		subLabel: 'Blur uploaded images, GIFs and videos until tapped',
	},
	{
		key: 'embeds',
		label: 'Embeds',
		subLabel: 'Blur images, GIFs and videos in link embeds until tapped',
	},
];

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Blur'>
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
