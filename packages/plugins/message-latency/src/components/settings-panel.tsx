import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { Defaults, LATENCY_OPTIONS } from '~/constants';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const latency = store.get('latency', Defaults.latency);
	const next = LATENCY_OPTIONS[(LATENCY_OPTIONS.indexOf(latency) + 1) % LATENCY_OPTIONS.length];

	return (
		<ui.Page>
			<ui.Section title='Indicator'>
				<ui.Row
					label='Latency threshold'
					subLabel='Show an indicator when a message takes at least this long to send.'
					trailing={<Discord.TableRow.TrailingText text={`${latency}s`} />}
					onPress={() => store.set('latency', next)}
				/>
				<ui.SwitchRow
					label='Show milliseconds'
					subLabel='Include millisecond precision in the indicator.'
					value={store.get('showMillis', Defaults.showMillis)}
					onValueChange={(value) => store.set('showMillis', value)}
				/>
				<ui.SwitchRow
					label='Ignore my messages'
					subLabel='Only mark messages sent by other people.'
					value={store.get('ignoreSelf', Defaults.ignoreSelf)}
					onValueChange={(value) => store.set('ignoreSelf', value)}
				/>
				<ui.SwitchRow
					label='Detect legacy Android clients'
					subLabel='Show a marker for the known timestamp offset in older Discord Android clients.'
					value={store.get('detectDiscordKotlin', Defaults.detectDiscordKotlin)}
					onValueChange={(value) => store.set('detectDiscordKotlin', value)}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
