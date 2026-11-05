import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		scrobblerBackend: setting.choice({
			default: 'lastfm',
			title: 'SCROBBLER',
			options: {
				lastfm: 'SCROBBLER_LASTFM',
				listenbrainz: 'SCROBBLER_LISTENBRAINZ',
				'listenbrainz-compatible': 'SCROBBLER_LISTENBRAINZ_COMPATIBLE',
			},
		}),
		username: setting.string({
			default: '',
			title: 'USERNAME',
			subtitle: 'USERNAME_SUBTITLE',
			displayAs: 'input',
		}),
		apiKey: setting.string({
			default: '',
			title: 'API_KEY',
			subtitle: 'API_KEY_SUBTITLE',
			displayAs: 'input',
			visibleWhen: (settings) => settings.scrobblerBackend === 'lastfm',
		}),
		createApiKey: setting.button({
			title: 'CREATE_API_KEY',
			subtitle: 'CREATE_API_KEY_SUBTITLE',
			action: 'createApiKey',
			visibleWhen: (settings) => settings.scrobblerBackend === 'lastfm',
		}),
		instanceIncomplete: setting.notice({
			title: 'INSTANCE_INCOMPLETE',
			subtitle: 'INSTANCE_INCOMPLETE_SUBTITLE',
			tone: 'warning',
			visibleWhen: (settings) =>
				settings.scrobblerBackend === 'listenbrainz-compatible' &&
				(!settings.instanceBaseURL.trim() || !settings.instanceAPIBaseUrl.trim()),
		}),
		instanceBaseURL: setting.string({
			default: '',
			title: 'INSTANCE_URL',
			subtitle: 'INSTANCE_SUBTITLE',
			placeholder: 'INSTANCE_URL_PLACEHOLDER',
			displayAs: 'input',
			visibleWhen: (settings) => settings.scrobblerBackend === 'listenbrainz-compatible',
		}),
		instanceAPIBaseUrl: setting.string({
			default: '',
			title: 'API_URL',
			subtitle: 'INSTANCE_SUBTITLE',
			placeholder: 'API_URL_PLACEHOLDER',
			displayAs: 'input',
			visibleWhen: (settings) => settings.scrobblerBackend === 'listenbrainz-compatible',
		}),
		statusName: setting.string({
			default: 'some music',
			title: 'STATUS_NAME',
			subtitle: 'STATUS_NAME_SUBTITLE',
			displayAs: 'input',
		}),
		nameFormat: setting.choice({
			default: 'status-name',
			title: 'NAME_FORMAT',
			displayAs: 'picker',
			options: {
				'status-name': 'NAME_FORMAT_STATUS_NAME',
				'service-name': 'NAME_FORMAT_SERVICE_NAME',
				'artist-first': 'NAME_FORMAT_ARTIST_FIRST',
				'song-first': 'NAME_FORMAT_SONG_FIRST',
				artist: 'NAME_FORMAT_ARTIST',
				song: 'NAME_FORMAT_SONG',
				album: 'NAME_FORMAT_ALBUM',
			},
		}),
		statusDisplayType: setting.choice({
			default: 'artist',
			title: 'MEMBER_LIST_SHOWS',
			options: {
				off: 'MEMBER_LIST_ACTIVITY',
				artist: 'MEMBER_LIST_ARTIST',
				track: 'MEMBER_LIST_TRACK',
			},
		}),
		missingArt: setting.choice({
			default: 'logo',
			title: 'WITHOUT_ALBUM_ART',
			options: { logo: 'MISSING_ART_LOGO', placeholder: 'MISSING_ART_PLACEHOLDER' },
		}),
		useListeningStatus: setting.boolean({
			default: false,
			title: 'LISTENING_STATUS',
			subtitle: 'LISTENING_STATUS_SUBTITLE',
		}),
		clickableLinks: setting.boolean({
			default: true,
			title: 'CLICKABLE_LINKS',
			subtitle: 'CLICKABLE_LINKS_SUBTITLE',
		}),
		shareUsername: setting.boolean({
			default: false,
			title: 'PROFILE_BUTTON',
			subtitle: 'PROFILE_BUTTON_SUBTITLE',
		}),
		showAlbumCover: setting.boolean({
			default: true,
			title: 'ALBUM_COVER',
			subtitle: 'ALBUM_COVER_SUBTITLE',
		}),
		showLogo: setting.boolean({
			default: true,
			title: 'SCROBBLER_LOGO',
			subtitle: 'SCROBBLER_LOGO_SUBTITLE',
		}),
		hideWithSpotify: setting.boolean({
			default: true,
			title: 'HIDE_WITH_SPOTIFY',
			subtitle: 'HIDE_WITH_SPOTIFY_SUBTITLE',
		}),
		hideWithActivity: setting.boolean({
			default: false,
			title: 'HIDE_WITH_ACTIVITY',
			subtitle: 'HIDE_WITH_ACTIVITY_SUBTITLE',
		}),
	},
	{ title: 'MUSIC_RICH_PRESENCE' },
);
