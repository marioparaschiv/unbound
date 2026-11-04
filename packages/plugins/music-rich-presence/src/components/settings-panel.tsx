import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';
import { Linking } from 'react-native';

import { LASTFM_API_KEY_URL, type Preferences } from '~/constants';
import { hasInvalidCustomInstance, readPreferences } from '~/preferences';

type Bucket = ReturnType<typeof storage.useBucket>;

type TextKey = 'username' | 'apiKey' | 'instanceBaseURL' | 'instanceAPIBaseUrl' | 'statusName';

type SwitchKey = {
	[K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

type Choice = { label: string; value: string };

const BACKENDS: Choice[] = [
	{ label: 'Last.fm', value: 'lastfm' },
	{ label: 'ListenBrainz', value: 'listenbrainz' },
	{ label: 'ListenBrainz Compatible (self-hosted)', value: 'listenbrainz-compatible' },
];

const NAME_FORMATS: Choice[] = [
	{ label: 'Custom status text', value: 'status-name' },
	{ label: 'Music service name, else custom text', value: 'service-name' },
	{ label: 'Artist - Song', value: 'artist-first' },
	{ label: 'Song - Artist', value: 'song-first' },
	{ label: 'Artist only', value: 'artist' },
	{ label: 'Song only', value: 'song' },
	{ label: 'Album, else custom text', value: 'album' },
];

const STATUS_DISPLAYS: Choice[] = [
	{ label: 'Activity name', value: 'off' },
	{ label: 'Artist', value: 'artist' },
	{ label: 'Track', value: 'track' },
];

const MISSING_ART: Choice[] = [
	{ label: 'Large scrobbler logo', value: 'logo' },
	{ label: 'Generic placeholder', value: 'placeholder' },
];

const SWITCHES: { key: SwitchKey; label: string; subLabel: string }[] = [
	{
		key: 'useListeningStatus',
		label: 'Listening Status',
		subLabel: 'Show "Listening to" instead of "Playing"',
	},
	{
		key: 'clickableLinks',
		label: 'Clickable Links',
		subLabel: 'Link the track, artist and album names',
	},
	{
		key: 'shareUsername',
		label: 'Profile Button',
		subLabel: 'Add a button that links to your scrobbler profile',
	},
	{
		key: 'showAlbumCover',
		label: 'Album Cover',
		subLabel: 'Turn off to show a placeholder instead, for covers you would rather not share',
	},
	{
		key: 'showLogo',
		label: 'Scrobbler Logo',
		subLabel: 'Show the scrobbler logo next to the album cover',
	},
	{
		key: 'hideWithSpotify',
		label: 'Hide With Spotify',
		subLabel: 'Hide while Spotify or another app shows what you are listening to',
	},
	{
		key: 'hideWithActivity',
		label: 'Hide With Other Activities',
		subLabel: 'Hide while you have any other activity',
	},
];

function TextSetting({
	store,
	storeKey,
	label,
	description,
	placeholder,
	value,
}: {
	store: Bucket;
	storeKey: TextKey;
	label: string;
	description?: string;
	placeholder?: string;
	value: string;
}) {
	const [draft, setDraft] = useState(value);

	function save() {
		store.set(storeKey, draft.trim());
	}

	return (
		<Discord.TextInput
			label={label}
			description={description}
			value={draft}
			onChange={setDraft}
			onEndEditing={save}
			onSubmitEditing={save}
			autoCapitalize='none'
			autoCorrect={false}
			placeholder={placeholder}
		/>
	);
}

function RadioSetting({
	store,
	storeKey,
	title,
	value,
	choices,
}: {
	store: Bucket;
	storeKey: keyof Preferences;
	title: string;
	value: string;
	choices: Choice[];
}) {
	return (
		<Discord.TableRadioGroup
			title={title}
			value={value}
			onChange={(next: string) => store.set(storeKey, next)}
		>
			{choices.map((choice) => (
				<Discord.TableRadioRow
					key={choice.value}
					label={choice.label}
					value={choice.value}
				/>
			))}
		</Discord.TableRadioGroup>
	);
}

function BackendSection({ store, preferences }: { store: Bucket; preferences: Preferences }) {
	if (preferences.scrobblerBackend === 'lastfm') {
		return (
			<ui.Section title='Last.fm'>
				<ui.Row
					label='Create an API Key'
					subLabel='Optional, but avoids the rate limit of the shared key. Set any name and description and leave the rest blank.'
					arrow
					onPress={() => void Linking.openURL(LASTFM_API_KEY_URL)}
				/>
			</ui.Section>
		);
	}

	if (preferences.scrobblerBackend !== 'listenbrainz-compatible') return null;

	return (
		<>
			{hasInvalidCustomInstance(preferences) ? (
				<ui.Section title='Self-hosted Instance'>
					<ui.Row
						label='Instance Incomplete'
						subLabel='Set both the instance URL and the API URL, or switch back to ListenBrainz or Last.fm.'
					/>
				</ui.Section>
			) : null}
			<TextSetting
				store={store}
				storeKey='instanceBaseURL'
				label='Instance URL'
				placeholder='https://example.org'
				value={preferences.instanceBaseURL}
			/>
			<TextSetting
				store={store}
				storeKey='instanceAPIBaseUrl'
				label='API URL'
				placeholder='https://api.example.org'
				value={preferences.instanceAPIBaseUrl}
			/>
		</>
	);
}

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const preferences = readPreferences(store.get);

	return (
		<ui.Page>
			<RadioSetting
				store={store}
				storeKey='scrobblerBackend'
				title='Scrobbler'
				value={preferences.scrobblerBackend}
				choices={BACKENDS}
			/>
			<TextSetting
				store={store}
				storeKey='username'
				label='Username'
				description='Your username on the chosen scrobbler. Nothing shows until it is set.'
				value={preferences.username}
			/>
			{preferences.scrobblerBackend === 'lastfm' ? (
				<TextSetting
					store={store}
					storeKey='apiKey'
					label='API Key'
					description='Your own Last.fm API key. Leave empty to use the shared key.'
					value={preferences.apiKey}
				/>
			) : null}
			<BackendSection store={store} preferences={preferences} />
			<TextSetting
				store={store}
				storeKey='statusName'
				label='Custom Status Text'
				description='Use {artist}, {album} and {title} for the playing track.'
				value={preferences.statusName}
			/>
			<RadioSetting
				store={store}
				storeKey='nameFormat'
				title='Activity Name'
				value={preferences.nameFormat}
				choices={NAME_FORMATS}
			/>
			<RadioSetting
				store={store}
				storeKey='statusDisplayType'
				title='Member List Shows'
				value={preferences.statusDisplayType}
				choices={STATUS_DISPLAYS}
			/>
			<RadioSetting
				store={store}
				storeKey='missingArt'
				title='Without Album Art'
				value={preferences.missingArt}
				choices={MISSING_ART}
			/>
			<ui.Section title='Options'>
				{SWITCHES.map(({ key, label, subLabel }) => (
					<ui.SwitchRow
						key={key}
						label={label}
						subLabel={subLabel}
						value={preferences[key]}
						onValueChange={(value) => store.set(key, value)}
					/>
				))}
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
