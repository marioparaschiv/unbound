import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRadioGroup
				title='Pronouns'
				value={store.get('format', 'lowercase')}
				onChange={(value) => store.set('format', value)}
			>
				<Discord.TableRadioRow label='Lowercase' value='lowercase' />
				<Discord.TableRadioRow label='Capitalized' value='capitalized' />
			</Discord.TableRadioGroup>
			<Discord.TableRadioGroup
				title='Source'
				value={store.get('priority', 'pronoundb')}
				onChange={(value) => store.set('priority', value)}
			>
				<Discord.TableRadioRow
					label='Prefer PronounDB'
					subLabel='Fall back to Discord profile pronouns'
					value='pronoundb'
				/>
				<Discord.TableRadioRow
					label='Prefer Discord'
					subLabel='Fall back to PronounDB'
					value='discord'
				/>
			</Discord.TableRadioGroup>
			<Discord.TableRowGroup title='Visibility'>
				<Discord.TableSwitchRow
					label='Show for Yourself'
					value={store.get('showSelf', true)}
					onValueChange={(value) => store.set('showSelf', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
