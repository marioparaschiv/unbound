import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	users: setting.string({ default: '', hidden: true }),
	sound: setting.choice({
		default: 'activity_user_join',
		title: 'SOUND',
		subtitle: 'SOUND_SUBTITLE',
		options: {
			activity_user_join: 'SOUND_ACTIVITY_JOIN',
			stream_user_joined: 'SOUND_STREAM_JOIN',
			activity_launch: 'SOUND_ACTIVITY_LAUNCH',
			mention1: 'SOUND_MENTION',
			bit_message1: 'SOUND_BIT',
			camera_on: 'SOUND_CAMERA',
			ptt_start: 'SOUND_PTT',
		},
	}),
	volume: setting.number({
		default: 60,
		min: 10,
		max: 100,
		step: 10,
		title: 'VOLUME',
		subtitle: 'VOLUME_SUBTITLE',
	}),
});
