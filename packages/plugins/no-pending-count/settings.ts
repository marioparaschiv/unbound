import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	friendRequests: setting.boolean({
		default: true,
		title: 'FRIEND_REQUESTS',
		subtitle: 'FRIEND_REQUESTS_SUBTITLE',
	}),
	messageRequests: setting.boolean({
		default: true,
		title: 'MESSAGE_REQUESTS',
		subtitle: 'MESSAGE_REQUESTS_SUBTITLE',
	}),
});
