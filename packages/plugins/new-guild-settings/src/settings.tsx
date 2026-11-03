import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';

import { DEFAULTS, MessageNotifications, PLUGIN_ID, type SettingKey } from '~/constants';

type Toggle = {
	key: Exclude<SettingKey, 'messages'>;
	label: string;
	subLabel: string;
};

const TOGGLES: Toggle[] = [
	{ key: 'guild', label: 'Mute Server', subLabel: 'Mute new servers automatically' },
	{
		key: 'everyone',
		label: 'Suppress @everyone and @here',
		subLabel: 'Ignore @everyone and @here in new servers',
	},
	{
		key: 'role',
		label: 'Suppress All Role @mentions',
		subLabel: 'Ignore role mentions in new servers',
	},
	{
		key: 'highlights',
		label: 'Suppress Highlights',
		subLabel: 'Turn off highlight notifications in new servers',
	},
	{ key: 'events', label: 'Mute New Events', subLabel: 'Mute scheduled event notifications' },
	{
		key: 'showAllChannels',
		label: 'Show All Channels',
		subLabel: 'Show every channel in servers that let you pick channels',
	},
];

const MESSAGE_OPTIONS = [
	{ label: 'All Messages', value: MessageNotifications.All },
	{ label: 'Only @mentions', value: MessageNotifications.Mentions },
	{ label: 'Nothing', value: MessageNotifications.Nothing },
	{ label: 'Server Default', value: MessageNotifications.ServerDefault },
];

function SettingsPanel() {
	const settings = storage.useBucket(PLUGIN_ID);

	return (
		<ui.Page>
			<ui.Section title='When you join a server'>
				{TOGGLES.map(({ key, label, subLabel }) => (
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
				title='Server Notification Settings'
				value={String(settings.get('messages', DEFAULTS.messages))}
				onChange={(value) => settings.set('messages', Number(value))}
			>
				{MESSAGE_OPTIONS.map(({ label, value }) => (
					<Discord.TableRadioRow key={value} label={label} value={String(value)} />
				))}
			</Discord.TableRadioGroup>
		</ui.Page>
	);
}

export default SettingsPanel;
