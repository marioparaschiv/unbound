import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';

import { MAX_RANDOM_LENGTH, MIN_RANDOM_LENGTH, SETTINGS } from '~/constants';
import { readSettings } from '~/filenames';

function ConsistentNameInput() {
	const store = storage.useBucket(addon.id);
	const [value, setValue] = useState(String(store.get('consistent', SETTINGS.consistent)));

	function save() {
		store.set('consistent', value.trim() || SETTINGS.consistent);
	}

	return (
		<Discord.TextInput
			label='File Name'
			description='Every file is uploaded with this name and its own extension.'
			value={value}
			onChange={setValue}
			onEndEditing={save}
			onSubmitEditing={save}
			autoCapitalize='none'
			autoCorrect={false}
			placeholder={SETTINGS.consistent}
		/>
	);
}

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const current = readSettings((key, fallback) => store.get(key, fallback));

	return (
		<ui.Page>
			<ui.Section title='Behavior'>
				<ui.SwitchRow
					label='Anonymise by Default'
					subLabel='Each file can still be switched from its preview sheet'
					value={current.anonymiseByDefault}
					onValueChange={(value) => store.set('anonymiseByDefault', value)}
				/>
			</ui.Section>
			<Discord.TableRadioGroup
				title='Method'
				value={current.method}
				onChange={(value) => store.set('method', value)}
			>
				<Discord.TableRadioRow label='Random Characters' value='random' />
				<Discord.TableRadioRow label='Consistent' value='consistent' />
				<Discord.TableRadioRow label='Timestamp' value='timestamp' />
			</Discord.TableRadioGroup>
			{current.method === 'random' && (
				<ui.Section title='Random Characters'>
					<ui.SliderRow
						label='Length'
						value={current.randomisedLength}
						defaultValue={SETTINGS.randomisedLength}
						minimum={MIN_RANDOM_LENGTH}
						maximum={MAX_RANDOM_LENGTH}
						step={1}
						onChange={(value) => store.set('randomisedLength', value)}
					/>
				</ui.Section>
			)}
			{current.method === 'consistent' && <ConsistentNameInput key={current.consistent} />}
			<ui.ResetRow
				onReset={() => {
					for (const [key, value] of Object.entries(SETTINGS)) store.set(key, value);
				}}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
