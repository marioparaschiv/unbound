import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';

import { IndicatorMode } from '~/constants';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup title='Channel typing indicators'>
				<Discord.TableSwitchRow
					label='Include current channel'
					subLabel='Show typing activity in the selected channel.'
					value={store.get('includeCurrentChannel', true)}
					onValueChange={(value) => store.set('includeCurrentChannel', value)}
				/>
				<Discord.TableSwitchRow
					label='Include muted channels'
					subLabel='Show typing activity in muted channels.'
					value={store.get('includeMutedChannels', false)}
					onValueChange={(value) => store.set('includeMutedChannels', value)}
				/>
				<Discord.TableSwitchRow
					label='Include ignored users'
					subLabel='Show typing activity from ignored users.'
					value={store.get('includeIgnoredUsers', false)}
					onValueChange={(value) => store.set('includeIgnoredUsers', value)}
				/>
				<Discord.TableSwitchRow
					label='Include blocked users'
					subLabel='Show typing activity from blocked users.'
					value={store.get('includeBlockedUsers', false)}
					onValueChange={(value) => store.set('includeBlockedUsers', value)}
				/>
			</Discord.TableRowGroup>
			<Discord.TableRadioGroup
				title='Appearance'
				value={String(
					store.get('indicatorMode', IndicatorMode.Dots | IndicatorMode.Avatars),
				)}
				onChange={(value) => store.set('indicatorMode', Number(value))}
			>
				<Discord.TableRadioRow
					label='Avatars and animated dots'
					value={String(IndicatorMode.Dots | IndicatorMode.Avatars)}
				/>
				<Discord.TableRadioRow label='Animated dots' value={String(IndicatorMode.Dots)} />
				<Discord.TableRadioRow label='Avatars' value={String(IndicatorMode.Avatars)} />
			</Discord.TableRadioGroup>
		</Page>
	);
}

export default SettingsPanel;
