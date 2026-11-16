import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	everyone: setting.boolean({ default: true, title: 'EVERYONE', subtitle: 'EVERYONE_SUBTITLE' }),
	users: setting.integer({
		default: 5,
		min: 2,
		max: 50,
		title: 'USERS',
		subtitle: 'USERS_SUBTITLE',
	}),
	roles: setting.integer({
		default: 2,
		min: 1,
		max: 20,
		title: 'ROLES',
		subtitle: 'ROLES_SUBTITLE',
	}),
});
