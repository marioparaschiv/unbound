import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup title='Visibility'>
				<Discord.TableSwitchRow
					label='Show Timeout Icons'
					subLabel='Show member timeout icons in chat'
					value={store.get('showTimeouts', true)}
					onValueChange={(value) => store.set('showTimeouts', value)}
				/>
				<Discord.TableSwitchRow
					label='Show Paused Invites'
					subLabel='Show paused-invite notices in server views'
					value={store.get('showInvitesPaused', true)}
					onValueChange={(value) => store.set('showInvitesPaused', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
