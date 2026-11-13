import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	users: setting.string({ default: '', hidden: true }),
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
