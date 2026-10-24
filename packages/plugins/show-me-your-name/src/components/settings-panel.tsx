import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
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
			<Discord.TableRowGroup title='Preferences'>
				<Discord.TableSwitchRow
					label='Show Friend Nicknames'
					subLabel="Prefer a friend's nickname wherever it applies"
					value={store.get('friendNicknames', true)}
					onValueChange={(value) => store.set('friendNicknames', value)}
				/>
				<Discord.TableSwitchRow
					label='Use Global Names'
					subLabel="Show the account's global name instead of its username"
					value={store.get('displayNames', false)}
					onValueChange={(value) => store.set('displayNames', value)}
				/>
				<Discord.TableSwitchRow
					label='Apply To Replies'
					subLabel='Also apply to reply previews'
					value={store.get('inReplies', false)}
					onValueChange={(value) => store.set('inReplies', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
