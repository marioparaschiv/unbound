import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup title='General'>
				<Discord.TableSwitchRow
					label='Play on reactions'
					subLabel='Play the sound when someone reacts with Moyai.'
					value={store.get('allowReactions', true)}
					onValueChange={(value) => store.set('allowReactions', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
