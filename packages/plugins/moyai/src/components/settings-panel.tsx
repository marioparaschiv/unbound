import { storage, ui } from '@unbound-app/api';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='General'>
				<ui.SwitchRow
					label='Play on reactions'
					subLabel='Play the sound when someone reacts with Moyai.'
					value={store.get('allowReactions', true)}
					onValueChange={(value) => store.set('allowReactions', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
