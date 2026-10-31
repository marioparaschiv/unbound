import { storage, ui } from '@unbound-app/api';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Appearance'>
				<ui.SwitchRow
					label='Color thresholds'
					subLabel='Warn as the message approaches Discord’s character limit.'
					value={store.get('colorEffects', true)}
					onValueChange={(value) => store.set('colorEffects', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
