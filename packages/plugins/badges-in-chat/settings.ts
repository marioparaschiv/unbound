import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	hidden: setting.array({
		title: 'HIDDEN_BADGES',
		subtitle: 'HIDDEN_BADGES_SUBTITLE',
		of: setting.string(),
		default: ['legacy_username', 'quest_completed', 'orb_profile_badge'],
	}),
	overRoleIcons: setting.boolean({
		default: false,
		title: 'OVER_ROLE_ICONS',
		subtitle: 'OVER_ROLE_ICONS_SUBTITLE',
	}),
});
