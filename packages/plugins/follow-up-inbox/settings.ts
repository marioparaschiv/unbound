import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	doneOnReply: setting.boolean({
		default: true,
		title: 'DONE_ON_REPLY',
		subtitle: 'DONE_ON_REPLY_SUBTITLE',
	}),
});
