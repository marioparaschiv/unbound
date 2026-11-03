import { storage, ui } from '@unbound-app/api';

import { SETTINGS } from '~/constants';

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Picture in Picture'>
				<ui.SwitchRow
					label='Loop'
					subLabel='Loop the video while it plays in the floating window'
					value={settings.get('loop', SETTINGS.loop)}
					onValueChange={(value) => settings.set('loop', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
