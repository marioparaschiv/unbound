import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	chatMentions: setting.boolean({
		default: true,
		title: 'COLOR_MENTIONS',
		subtitle: 'COLOR_MENTIONS_SUBTITLE',
	}),
	colorChatMessages: setting.boolean({
		default: false,
		title: 'COLOR_MESSAGE_CONTENT',
		subtitle: 'COLOR_MESSAGE_CONTENT_SUBTITLE',
	}),
	messageSaturation: setting.integer({
		default: 30,
		min: 0,
		max: 100,
		step: 10,
		title: 'MESSAGE_COLOR_INTENSITY',
	}),
	typingUsers: setting.boolean({
		default: true,
		title: 'TYPING_NAMES',
		subtitle: 'TYPING_NAMES_SUBTITLE',
	}),
	memberList: setting.boolean({
		default: true,
		title: 'MEMBER_LIST_ROLE_HEADERS',
		subtitle: 'MEMBER_LIST_ROLE_HEADERS_SUBTITLE',
	}),
	reactorsList: setting.boolean({
		default: true,
		title: 'REACTION_USERS',
		subtitle: 'REACTION_USERS_SUBTITLE',
	}),
	pollResults: setting.boolean({
		default: true,
		title: 'POLL_VOTERS',
		subtitle: 'POLL_VOTERS_SUBTITLE',
	}),
	voiceUsers: setting.boolean({
		default: true,
		title: 'VOICE_USERS',
		subtitle: 'VOICE_USERS_SUBTITLE',
	}),
});
