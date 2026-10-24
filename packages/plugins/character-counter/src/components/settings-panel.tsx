import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup title='Appearance'>
				<Discord.TableSwitchRow
					label='Color thresholds'
					subLabel='Warn as the message approaches Discord’s character limit.'
					value={store.get('colorEffects', true)}
					onValueChange={(value) => store.set('colorEffects', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
