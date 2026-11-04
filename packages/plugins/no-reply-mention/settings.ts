import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	userList: setting.string({ default: '', hidden: true }),
	shouldPingListed: setting.boolean({ default: false, title: 'ONLY_PING_LISTED' }),
});
