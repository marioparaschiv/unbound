import { Discord } from '@unbound-app/api/metro/components';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { IndicatorMode } from '~/lib/constants';

/**
 * @description The settings panel: the filters as switches, and the indicator's appearance as a radio group,
 * which the generated panel cannot draw because the mode is a bit flag.
 */
export function SettingsPanel() {
	const includeCurrentChannel = useSetting('includeCurrentChannel');
	const includeMutedChannels = useSetting('includeMutedChannels');
	const includeIgnoredUsers = useSetting('includeIgnoredUsers');
	const includeBlockedUsers = useSetting('includeBlockedUsers');
	const indicatorMode = useSetting('indicatorMode');

	return (
		<ui.Page>
			<ui.Section title={messages.CHANNEL_TYPING_INDICATORS}>
				<ui.SwitchRow
					label={messages.INCLUDE_CURRENT_CHANNEL}
					subLabel={messages.INCLUDE_CURRENT_CHANNEL_SUBTITLE}
					value={includeCurrentChannel}
					onValueChange={(value) => (settings.includeCurrentChannel = value)}
				/>
				<ui.SwitchRow
					label={messages.INCLUDE_MUTED_CHANNELS}
					subLabel={messages.INCLUDE_MUTED_CHANNELS_SUBTITLE}
					value={includeMutedChannels}
					onValueChange={(value) => (settings.includeMutedChannels = value)}
				/>
				<ui.SwitchRow
					label={messages.INCLUDE_IGNORED_USERS}
					subLabel={messages.INCLUDE_IGNORED_USERS_SUBTITLE}
					value={includeIgnoredUsers}
					onValueChange={(value) => (settings.includeIgnoredUsers = value)}
				/>
				<ui.SwitchRow
					label={messages.INCLUDE_BLOCKED_USERS}
					subLabel={messages.INCLUDE_BLOCKED_USERS_SUBTITLE}
					value={includeBlockedUsers}
					onValueChange={(value) => (settings.includeBlockedUsers = value)}
				/>
			</ui.Section>
			<Discord.TableRadioGroup
				title={messages.APPEARANCE}
				value={String(indicatorMode)}
				onChange={(value: string) => (settings.indicatorMode = Number(value))}
			>
				<Discord.TableRadioRow
					label={messages.APPEARANCE_BOTH}
					value={String(IndicatorMode.Dots | IndicatorMode.Avatars)}
				/>
				<Discord.TableRadioRow
					label={messages.APPEARANCE_DOTS}
					value={String(IndicatorMode.Dots)}
				/>
				<Discord.TableRadioRow
					label={messages.APPEARANCE_AVATARS}
					value={String(IndicatorMode.Avatars)}
				/>
			</Discord.TableRadioGroup>
		</ui.Page>
	);
}
