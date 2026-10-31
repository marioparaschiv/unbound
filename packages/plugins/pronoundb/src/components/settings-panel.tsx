import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
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
			<ui.Section title='Visibility'>
				<ui.SwitchRow
					label='Show for Yourself'
					value={store.get('showSelf', true)}
					onValueChange={(value) => store.set('showSelf', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
