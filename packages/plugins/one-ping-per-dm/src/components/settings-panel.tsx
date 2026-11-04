import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { SETTINGS } from '~/constants';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='DMs to affect'
				value={store.get('channelToAffect', SETTINGS.channelToAffect)}
				onChange={(value: string) => store.set('channelToAffect', value)}
			>
				<Discord.TableRadioRow label='Both' value='both_dms' />
				<Discord.TableRadioRow label='User DMs' value='user_dm' />
				<Discord.TableRadioRow label='Group DMs' value='group_dm' />
			</Discord.TableRadioGroup>
			<ui.Section title='Exceptions'>
				<ui.SwitchRow
					label='Allow Mentions'
					subLabel='Play the sound for every message that mentions you'
					value={store.get('allowMentions', SETTINGS.allowMentions)}
					onValueChange={(value) => store.set('allowMentions', value)}
				/>
				<ui.SwitchRow
					label='Allow @everyone'
					subLabel='Play the sound for every @everyone and @here in group DMs'
					value={store.get('allowEveryone', SETTINGS.allowEveryone)}
					onValueChange={(value) => store.set('allowEveryone', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
