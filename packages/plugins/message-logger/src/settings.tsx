import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';

import { DEFAULT_SETTINGS, type SettingKey } from '~/constants';

type Toggle = {
	key: Exclude<SettingKey, 'ignoreUsers' | 'ignoreChannels' | 'ignoreGuilds'>;
	label: string;
	subLabel: string;
};

const APPEARANCE: Toggle[] = [
	{ key: 'redText', label: 'Red text', subLabel: 'Show the text of deleted messages in red.' },
	{
		key: 'deletedMarker',
		label: 'Deleted marker',
		subLabel: 'Show "This message was deleted" under deleted messages, with a Dismiss link.',
	},
	{
		key: 'inlineEdits',
		label: 'Show edits inline',
		subLabel: 'Show earlier versions of an edited message above its current text.',
	},
];

const LOGGING: Toggle[] = [
	{
		key: 'logDeletes',
		label: 'Log deleted messages',
		subLabel: 'Keep deleted messages in the chat.',
	},
	{
		key: 'logEdits',
		label: 'Log edited messages',
		subLabel: 'Keep the earlier versions of edited messages.',
	},
	{
		key: 'logDeletedAttachments',
		label: 'Log deleted attachments',
		subLabel: 'Keep attachments removed by an edit, marked as deleted.',
	},
	{ key: 'ignoreBots', label: 'Ignore bots', subLabel: 'Do not log messages sent by bots.' },
	{ key: 'ignoreSelf', label: 'Ignore yourself', subLabel: 'Do not log your own messages.' },
];

const ID_LISTS = [
	{
		key: 'ignoreUsers',
		label: 'Ignored users',
		description: 'User IDs whose messages are not logged.',
	},
	{
		key: 'ignoreChannels',
		label: 'Ignored channels',
		description: 'Channel or category IDs that are not logged.',
	},
	{
		key: 'ignoreGuilds',
		label: 'Ignored servers',
		description: 'Server IDs that are not logged.',
	},
] as const;

function IdListInput({
	storeKey,
	label,
	description,
}: {
	storeKey: (typeof ID_LISTS)[number]['key'];
	label: string;
	description: string;
}) {
	const store = storage.useBucket(addon.id);
	const [value, setValue] = useState(String(store.get(storeKey, DEFAULT_SETTINGS[storeKey])));

	function save() {
		store.set(storeKey, value.trim());
	}

	return (
		<Discord.TextInput
			label={label}
			description={`${description} Separate IDs with commas or spaces.`}
			value={value}
			onChange={setValue}
			onEndEditing={save}
			onSubmitEditing={save}
			autoCapitalize='none'
			placeholder='123456789012345678'
		/>
	);
}

function SettingsPanel() {
	const store = storage.useBucket(addon.id);

	function toggles(items: Toggle[]) {
		return items.map(({ key, label, subLabel }) => (
			<ui.SwitchRow
				key={key}
				label={label}
				subLabel={subLabel}
				value={Boolean(store.get(key, DEFAULT_SETTINGS[key]))}
				onValueChange={(value) => store.set(key, value)}
			/>
		));
	}

	return (
		<ui.Page>
			<ui.Section title='Appearance'>{toggles(APPEARANCE)}</ui.Section>
			<ui.Section title='Logging'>{toggles(LOGGING)}</ui.Section>
			{ID_LISTS.map(({ key, label, description }) => (
				<IdListInput key={key} storeKey={key} label={label} description={description} />
			))}
		</ui.Page>
	);
}

export default SettingsPanel;
