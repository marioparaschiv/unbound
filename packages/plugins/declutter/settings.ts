import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	gift: setting.boolean({ default: true, title: 'GIFT', subtitle: 'GIFT_SUBTITLE' }),
	emptySend: setting.boolean({
		default: false,
		title: 'EMPTY_SEND',
		subtitle: 'EMPTY_SEND_SUBTITLE',
	}),
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
	nitroButton: setting.boolean({
		default: false,
		title: 'NITRO_BUTTON',
		subtitle: 'NITRO_BUTTON_SUBTITLE',
	}),
	orbsBalance: setting.boolean({
		default: false,
		title: 'ORBS_BALANCE',
		subtitle: 'ORBS_BALANCE_SUBTITLE',
	}),
	questDock: setting.boolean({
		default: false,
		title: 'QUEST_DOCK',
		subtitle: 'QUEST_DOCK_SUBTITLE',
	}),
	boostGoal: setting.boolean({
		default: false,
		title: 'BOOST_GOAL',
		subtitle: 'BOOST_GOAL_SUBTITLE',
	}),
	avatarDecorations: setting.boolean({
		default: false,
		title: 'AVATAR_DECORATIONS',
		subtitle: 'AVATAR_DECORATIONS_SUBTITLE',
	}),
	nameplates: setting.boolean({
		default: false,
		title: 'NAMEPLATES',
		subtitle: 'NAMEPLATES_SUBTITLE',
	}),
	profileEffects: setting.boolean({
		default: false,
		title: 'PROFILE_EFFECTS',
		subtitle: 'PROFILE_EFFECTS_SUBTITLE',
	}),
	profileFrames: setting.boolean({
		default: false,
		title: 'PROFILE_FRAMES',
		subtitle: 'PROFILE_FRAMES_SUBTITLE',
	}),
	badges: setting.boolean({
		default: false,
		title: 'BADGES',
		subtitle: 'BADGES_SUBTITLE',
	}),
	serverTags: setting.boolean({
		default: false,
		title: 'SERVER_TAGS',
		subtitle: 'SERVER_TAGS_SUBTITLE',
	}),
	displayNameStyles: setting.boolean({
		default: false,
		title: 'DISPLAY_NAME_STYLES',
		subtitle: 'DISPLAY_NAME_STYLES_SUBTITLE',
	}),
	wishlist: setting.boolean({
		default: false,
		title: 'PROFILE_TABS',
		subtitle: 'PROFILE_TABS_SUBTITLE',
	}),
	serverThemes: setting.boolean({
		default: false,
		title: 'SERVER_THEMES',
		subtitle: 'SERVER_THEMES_SUBTITLE',
	}),
	dmActivityCards: setting.boolean({
		default: false,
		title: 'DM_ACTIVITY_CARDS',
		subtitle: 'DM_ACTIVITY_CARDS_SUBTITLE',
	}),
	paymentNitro: setting.boolean({
		default: false,
		title: 'PAYMENT_NITRO',
		subtitle: 'PAYMENT_NITRO_SUBTITLE',
	}),
	paymentShop: setting.boolean({
		default: false,
		title: 'PAYMENT_SHOP',
		subtitle: 'PAYMENT_SHOP_SUBTITLE',
	}),
	paymentQuests: setting.boolean({
		default: false,
		title: 'PAYMENT_QUESTS',
		subtitle: 'PAYMENT_QUESTS_SUBTITLE',
	}),
	paymentSubscriptions: setting.boolean({
		default: false,
		title: 'PAYMENT_SUBSCRIPTIONS',
		subtitle: 'PAYMENT_SUBSCRIPTIONS_SUBTITLE',
	}),
	paymentBoosts: setting.boolean({
		default: false,
		title: 'PAYMENT_BOOSTS',
		subtitle: 'PAYMENT_BOOSTS_SUBTITLE',
	}),
	paymentGifts: setting.boolean({
		default: false,
		title: 'PAYMENT_GIFTS',
		subtitle: 'PAYMENT_GIFTS_SUBTITLE',
	}),
});
