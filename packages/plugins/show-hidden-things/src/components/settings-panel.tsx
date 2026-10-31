import { storage, ui } from '@unbound-app/api';

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Visibility'>
				<ui.SwitchRow
					label='Show Timeout Icons'
					subLabel='Show member timeout icons in chat'
					value={settings.get('showTimeouts', true)}
					onValueChange={(value) => settings.set('showTimeouts', value)}
				/>
				<ui.SwitchRow
					label='Show Paused Invites'
					subLabel='Show the Pause Invites setting in Server Settings to everyone'
					value={settings.get('showInvitesPaused', true)}
					onValueChange={(value) => settings.set('showInvitesPaused', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
