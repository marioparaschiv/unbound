import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	gift: setting.boolean({ default: true, title: 'GIFT', subtitle: 'GIFT_SUBTITLE' }),
	voiceMessage: setting.boolean({
		default: false,
		title: 'VOICE_MESSAGE',
		subtitle: 'VOICE_MESSAGE_SUBTITLE',
	}),
	voiceCall: setting.boolean({
		default: false,
		title: 'VOICE_CALL',
		subtitle: 'VOICE_CALL_SUBTITLE',
	}),
	videoCall: setting.boolean({
		default: false,
		title: 'VIDEO_CALL',
		subtitle: 'VIDEO_CALL_SUBTITLE',
	}),
	quests: setting.boolean({ default: false, title: 'QUESTS', subtitle: 'QUESTS_SUBTITLE' }),
	shop: setting.boolean({ default: false, title: 'SHOP', subtitle: 'SHOP_SUBTITLE' }),
	serverBoosts: setting.boolean({
		default: false,
		title: 'SERVER_BOOSTS',
		subtitle: 'SERVER_BOOSTS_SUBTITLE',
	}),
});
