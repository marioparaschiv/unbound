import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	allMessages: setting.boolean({
		default: false,
		title: 'ALL_MESSAGES',
		subtitle: 'ALL_MESSAGES_SUBTITLE',
	}),
});
