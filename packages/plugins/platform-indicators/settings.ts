import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	memberList: setting.boolean({
		default: true,
		title: 'MEMBER_LIST',
		subtitle: 'MEMBER_LIST_SUBTITLE',
	}),
	profiles: setting.boolean({
		default: true,
		title: 'PROFILES',
		subtitle: 'PROFILES_SUBTITLE',
	}),
	messages: setting.boolean({
		default: true,
		title: 'MESSAGES',
		subtitle: 'MESSAGES_SUBTITLE',
	}),
	colorMobileIndicator: setting.boolean({
		default: true,
		title: 'COLOR_MOBILE_INDICATOR',
		subtitle: 'COLOR_MOBILE_INDICATOR_SUBTITLE',
	}),
});
