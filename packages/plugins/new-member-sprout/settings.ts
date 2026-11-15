import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	days: setting.integer({
		default: 7,
		min: 1,
		max: 30,
		title: 'DAYS',
		subtitle: 'DAYS_SUBTITLE',
	}),
	overRoleIcons: setting.boolean({
		default: false,
		title: 'OVER_ROLE_ICONS',
		subtitle: 'OVER_ROLE_ICONS_SUBTITLE',
	}),
});
