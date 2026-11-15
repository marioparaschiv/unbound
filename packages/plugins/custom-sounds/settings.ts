import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	choices: setting.string({ default: '{}', hidden: true }),
	links: setting.string({ default: '{}', hidden: true }),
	users: setting.string({ default: '', hidden: true }),
	sound: setting.choice({
		default: 'activity_user_join',
		hidden: true,
		options: {
			activity_user_join: 'SOUND_ACTIVITY_JOIN',
			stream_user_joined: 'SOUND_STREAM_JOIN',
			activity_launch: 'SOUND_ACTIVITY_LAUNCH',
			mention1: 'SOUND_MENTION',
			bit_message1: 'SOUND_BIT',
			camera_on: 'SOUND_CAMERA',
			ptt_start: 'SOUND_PTT',
			link: 'SOUND_LINK',
		},
	}),
	joinLink: setting.string({ default: '', hidden: true }),
	volume: setting.number({ default: 60, min: 10, max: 100, step: 10, hidden: true }),
});
