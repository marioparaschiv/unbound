import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { toReplaceMode } from '~/preferences';
import { SETTINGS } from '~/constants';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title='Replace'
				value={toReplaceMode(store.get('replaceElements', SETTINGS.replaceElements))}
				onChange={(value) => store.set('replaceElements', value)}
			>
				<Discord.TableRadioRow label='Titles and Thumbnails' value='all' />
				<Discord.TableRadioRow label='Titles' value='titles' />
				<Discord.TableRadioRow label='Thumbnails' value='thumbnails' />
			</Discord.TableRadioGroup>
			<ui.Section title='Behavior'>
				<ui.SwitchRow
					label='Dearrow by Default'
					subLabel='Replace titles and thumbnails without asking'
					value={store.get('dearrowByDefault', SETTINGS.dearrowByDefault)}
					onValueChange={(value) => store.set('dearrowByDefault', value)}
				/>
				<ui.SwitchRow
					label='Show Toggle'
					subLabel='Switch an embed back and forth from the message menu'
					value={store.get('showToggle', SETTINGS.showToggle)}
					onValueChange={(value) => store.set('showToggle', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
