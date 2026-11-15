import EntityListRow from '@unbound-plugins/shared/entities/entity-list-row';
import { formatIdList, parseIdList } from '@unbound-plugins/shared/entities/id-list';
import EntityList from '@unbound-plugins/shared/entities/entity-list';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { DEFAULT, EVENTS, EXTRA_SOUNDS, LINK, readMap, type SoundEvent } from '~/lib/sounds';
import { activePlayer } from '~/lib/active-player';
import { playJoinSound } from '~/lib/join-sound';

const JOIN_SOUNDS = [
	'activity_user_join',
	'stream_user_joined',
	'activity_launch',
	'mention1',
	'bit_message1',
	'camera_on',
	'ptt_start',
] as const;

const JOIN_LABELS = {
	activity_user_join: 'SOUND_ACTIVITY_JOIN',
	stream_user_joined: 'SOUND_STREAM_JOIN',
	activity_launch: 'SOUND_ACTIVITY_LAUNCH',
	mention1: 'SOUND_MENTION',
	bit_message1: 'SOUND_BIT',
	camera_on: 'SOUND_CAMERA',
	ptt_start: 'SOUND_PTT',
} as const;

function replacementOptions(event: SoundEvent) {
	return [
		{ value: DEFAULT, label: messages.CHOICE_DEFAULT },
		...[...EVENTS, ...EXTRA_SOUNDS]
			.filter(({ name }) => name !== event.name)
			.map(({ name, label }) => ({ value: `sound:${name}`, label: messages[label] })),
		{ value: LINK, label: messages.SOUND_LINK },
	];
}

function setEntry(key: 'choices' | 'links', name: string, value: string) {
	const map = readMap(settings[key]);

	if (value) map[name] = value;
	else delete map[name];

	settings[key] = JSON.stringify(map);
}

function EventRows({ event }: { event: SoundEvent }) {
	const choice = readMap(useSetting('choices'))[event.name] ?? DEFAULT;
	const link = readMap(useSetting('links'))[event.name] ?? '';

	return (
		<>
			<ui.PickerRow
				label={messages[event.label]}
				value={choice}
				options={replacementOptions(event)}
				onChange={(value) =>
					setEntry('choices', event.name, value === DEFAULT ? '' : value)
				}
			/>
			{choice === LINK ? (
				<ui.UrlRow
					label={messages.LINK}
					value={link}
					onChange={(value) => setEntry('links', event.name, value ?? '')}
				/>
			) : null}
		</>
	);
}

function FriendList() {
	const value = useSetting('users');

	return (
		<EntityList
			kind='user'
			description={messages.FRIENDS_SUBTITLE}
			value={parseIdList(value)}
			labels={{
				add: messages.ADD_USER,
				title: messages.ADD_USER,
				search: messages.SEARCH_USERS,
				noResults: messages.NO_RESULTS,
				unknown: messages.UNKNOWN_USER,
				remove: messages.REMOVE,
			}}
			onChange={(ids) => {
				settings.users = formatIdList(ids);
			}}
		/>
	);
}

function JoinRows() {
	const count = parseIdList(useSetting('users')).length;
	const sound = useSetting('sound');
	const joinLink = useSetting('joinLink');
	const volume = useSetting('volume');

	return (
		<ui.Section title={messages.JOIN_SECTION} description={messages.JOIN_SECTION_SUBTITLE}>
			<EntityListRow
				label={messages.FRIENDS}
				count={count}
				renderList={() => <FriendList />}
			/>
			<ui.PickerRow
				label={messages.SOUND}
				value={sound}
				options={[
					...JOIN_SOUNDS.map((name) => ({
						value: name,
						label: messages[JOIN_LABELS[name]],
					})),
					{ value: LINK, label: messages.SOUND_LINK },
				]}
				onChange={(value) => {
					settings.sound = value as typeof settings.sound;
				}}
			/>
			{sound === LINK ? (
				<ui.UrlRow
					label={messages.LINK}
					value={joinLink}
					onChange={(value) => {
						settings.joinLink = value ?? '';
					}}
				/>
			) : null}
			<ui.SliderRow
				label={messages.VOLUME}
				value={volume}
				defaultValue={60}
				minimum={10}
				maximum={100}
				step={10}
				unit='%'
				onChange={(value) => {
					settings.volume = value;
				}}
			/>
			<ui.Row label={messages.PREVIEW} onPress={() => playJoinSound(activePlayer())} />
		</ui.Section>
	);
}

function SettingsPanel() {
	return (
		<ui.Page>
			<ui.Section
				title={messages.REPLACE_SECTION}
				description={messages.REPLACE_SECTION_SUBTITLE}
			>
				{EVENTS.map((event) => (
					<EventRows key={event.name} event={event} />
				))}
			</ui.Section>
			<JoinRows />
		</ui.Page>
	);
}

export default SettingsPanel;
