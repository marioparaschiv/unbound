import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { Defaults, LATENCY_OPTIONS } from '~/constants';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const latency = store.get('latency', Defaults.latency);
	const next = LATENCY_OPTIONS[(LATENCY_OPTIONS.indexOf(latency) + 1) % LATENCY_OPTIONS.length];

	return (
		<Page>
			<Discord.TableRowGroup title='Indicator'>
				<Discord.TableRow
					label='Latency threshold'
					subLabel='Show an indicator when a message takes at least this long to send.'
					trailing={<Discord.TableRow.TrailingText text={`${latency}s`} />}
					onPress={() => store.set('latency', next)}
				/>
				<Discord.TableSwitchRow
					label='Show milliseconds'
					subLabel='Include millisecond precision in the indicator.'
					value={store.get('showMillis', Defaults.showMillis)}
					onValueChange={(value) => store.set('showMillis', value)}
				/>
				<Discord.TableSwitchRow
					label='Ignore my messages'
					subLabel='Only mark messages sent by other people.'
					value={store.get('ignoreSelf', Defaults.ignoreSelf)}
					onValueChange={(value) => store.set('ignoreSelf', value)}
				/>
				<Discord.TableSwitchRow
					label='Detect legacy Android clients'
					subLabel='Show a marker for the known timestamp offset in older Discord Android clients.'
					value={store.get('detectDiscordKotlin', Defaults.detectDiscordKotlin)}
					onValueChange={(value) => store.set('detectDiscordKotlin', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
