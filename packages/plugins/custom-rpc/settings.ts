import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	appId: setting.string({ default: '', title: 'APP_ID', subtitle: 'APP_ID_SUBTITLE' }),
	appName: setting.string({ default: '', title: 'APP_NAME', subtitle: 'APP_NAME_SUBTITLE' }),
	type: setting.choice({
		default: 'playing',
		title: 'TYPE',
		options: {
			playing: 'TYPE_PLAYING',
			streaming: 'TYPE_STREAMING',
			listening: 'TYPE_LISTENING',
			watching: 'TYPE_WATCHING',
			competing: 'TYPE_COMPETING',
		},
	}),
	streamLink: setting.string({
		default: '',
		title: 'STREAM_LINK',
		displayAs: 'url',
		visibleWhen: (settings) => settings.type === 'streaming',
	}),
	details: setting.string({ default: '', title: 'DETAILS' }),
	state: setting.string({ default: '', title: 'STATE' }),
	timestamps: setting.choice({
		default: 'now',
		title: 'TIMESTAMPS',
		options: { none: 'TIMESTAMPS_NONE', now: 'TIMESTAMPS_NOW', time: 'TIMESTAMPS_TIME' },
	}),
	largeImage: setting.string({ default: '', title: 'LARGE_IMAGE', subtitle: 'IMAGE_SUBTITLE' }),
	largeText: setting.string({ default: '', title: 'LARGE_TEXT' }),
	smallImage: setting.string({ default: '', title: 'SMALL_IMAGE', subtitle: 'IMAGE_SUBTITLE' }),
	smallText: setting.string({ default: '', title: 'SMALL_TEXT' }),
	buttonOneText: setting.string({ default: '', title: 'BUTTON_ONE_TEXT' }),
	buttonOneUrl: setting.string({ default: '', title: 'BUTTON_ONE_URL', displayAs: 'url' }),
	buttonTwoText: setting.string({ default: '', title: 'BUTTON_TWO_TEXT' }),
	buttonTwoUrl: setting.string({ default: '', title: 'BUTTON_TWO_URL', displayAs: 'url' }),
});
