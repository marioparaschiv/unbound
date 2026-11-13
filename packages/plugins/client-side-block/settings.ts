import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	users: setting.array({
		title: 'HIDDEN_USERS',
		subtitle: 'HIDDEN_USERS_SUBTITLE',
		of: setting.string(),
		displayAs: 'user',
	}),
	ignored: setting.boolean({
		default: true,
		title: 'HIDE_IGNORED',
		subtitle: 'HIDE_IGNORED_SUBTITLE',
	}),
	replies: setting.boolean({
		default: true,
		title: 'HIDE_REPLIES',
		subtitle: 'HIDE_REPLIES_SUBTITLE',
	}),
});
