import { messages } from '@unbound-app/i18n';
import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { DEFAULTS, MessageNotifications, type SettingKey } from '~/constants';

type Toggle = {
	key: Exclude<SettingKey, 'messages'>;
	label: string;
	subLabel: string;
};

function SettingsPanel() {
	const settings = storage.useBucket(addon.id);

	const toggles: Toggle[] = [
		{ key: 'guild', label: messages.MUTE_SERVER, subLabel: messages.MUTE_SERVER_SUBTITLE },
		{
			key: 'everyone',
			label: messages.SUPPRESS_EVERYONE,
			subLabel: messages.SUPPRESS_EVERYONE_SUBTITLE,
		},
		{ key: 'role', label: messages.SUPPRESS_ROLES, subLabel: messages.SUPPRESS_ROLES_SUBTITLE },
		{
			key: 'highlights',
			label: messages.SUPPRESS_HIGHLIGHTS,
			subLabel: messages.SUPPRESS_HIGHLIGHTS_SUBTITLE,
		},
		{ key: 'events', label: messages.MUTE_EVENTS, subLabel: messages.MUTE_EVENTS_SUBTITLE },
		{
			key: 'showAllChannels',
			label: messages.SHOW_ALL_CHANNELS,
			subLabel: messages.SHOW_ALL_CHANNELS_SUBTITLE,
		},
	];

	const messageOptions = [
		{ label: messages.NOTIFY_ALL, value: MessageNotifications.All },
		{ label: messages.NOTIFY_MENTIONS, value: MessageNotifications.Mentions },
		{ label: messages.NOTIFY_NOTHING, value: MessageNotifications.Nothing },
		{ label: messages.NOTIFY_DEFAULT, value: MessageNotifications.ServerDefault },
	];

	return (
		<ui.Page>
			<ui.Section title={messages.WHEN_YOU_JOIN}>
				{toggles.map(({ key, label, subLabel }) => (
					<ui.SwitchRow
						key={key}
						label={label}
						subLabel={subLabel}
						value={settings.get(key, DEFAULTS[key])}
						onValueChange={(value) => settings.set(key, value)}
					/>
				))}
			</ui.Section>
			<Discord.TableRadioGroup
				title={messages.SERVER_NOTIFICATION_SETTINGS}
				value={String(settings.get('messages', DEFAULTS.messages))}
				onChange={(value) => settings.set('messages', Number(value))}
			>
				{messageOptions.map(({ label, value }) => (
					<Discord.TableRadioRow key={value} label={label} value={String(value)} />
				))}
			</Discord.TableRadioGroup>
		</ui.Page>
	);
}

export default SettingsPanel;
