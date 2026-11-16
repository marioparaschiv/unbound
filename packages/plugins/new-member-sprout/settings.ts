import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	overRoleIcons: setting.boolean({
		default: false,
		title: 'OVER_ROLE_ICONS',
		subtitle: 'OVER_ROLE_ICONS_SUBTITLE',
	}),
});
