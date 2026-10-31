import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='Display Mode'
				value={store.get('mode', 'nick-user')}
				onChange={(value) => store.set('mode', value)}
			>
				<Discord.TableRadioRow
					label='Display name then username'
					subLabel='Display Name (@username)'
					value='nick-user'
				/>
				<Discord.TableRadioRow
					label='Username then display name'
					subLabel='@username (Display Name)'
					value='user-nick'
				/>
				<Discord.TableRadioRow label='Username only' subLabel='@username' value='user' />
			</Discord.TableRadioGroup>
			<ui.Section title='Preferences'>
				<ui.SwitchRow
					label='Show Friend Nicknames'
					subLabel="Prefer a friend's nickname wherever it applies"
					value={store.get('friendNicknames', true)}
					onValueChange={(value) => store.set('friendNicknames', value)}
				/>
				<ui.SwitchRow
					label='Use Global Names'
					subLabel="Show the account's global name instead of its username"
					value={store.get('displayNames', false)}
					onValueChange={(value) => store.set('displayNames', value)}
				/>
				<ui.SwitchRow
					label='Apply To Replies'
					subLabel='Also apply to reply previews'
					value={store.get('inReplies', false)}
					onValueChange={(value) => store.set('inReplies', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
