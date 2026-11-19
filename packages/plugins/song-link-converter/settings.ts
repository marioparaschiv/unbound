import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	service: setting.choice({
		default: 'spotify',
		title: 'SERVICE',
		subtitle: 'SERVICE_SUBTITLE',
		displayAs: 'picker',
		options: {
			spotify: 'SPOTIFY',
			appleMusic: 'APPLE_MUSIC',
			youtubeMusic: 'YOUTUBE_MUSIC',
			deezer: 'DEEZER',
			tidal: 'TIDAL',
		},
	}),
});
