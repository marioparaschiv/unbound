import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { IndicatorMode } from '~/constants';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	return (
		<ui.Page>
			<ui.Section title='Channel typing indicators'>
				<ui.SwitchRow
					label='Include current channel'
					subLabel='Show typing activity in the selected channel.'
					value={store.get('includeCurrentChannel', true)}
					onValueChange={(value) => store.set('includeCurrentChannel', value)}
				/>
				<ui.SwitchRow
					label='Include muted channels'
					subLabel='Show typing activity in muted channels.'
					value={store.get('includeMutedChannels', false)}
					onValueChange={(value) => store.set('includeMutedChannels', value)}
				/>
				<ui.SwitchRow
					label='Include ignored users'
					subLabel='Show typing activity from ignored users.'
					value={store.get('includeIgnoredUsers', false)}
					onValueChange={(value) => store.set('includeIgnoredUsers', value)}
				/>
				<ui.SwitchRow
					label='Include blocked users'
					subLabel='Show typing activity from blocked users.'
					value={store.get('includeBlockedUsers', false)}
					onValueChange={(value) => store.set('includeBlockedUsers', value)}
				/>
			</ui.Section>
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
		</ui.Page>
	);
}

export default SettingsPanel;
