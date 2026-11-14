import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	nsfw: setting.boolean({ default: true, title: 'SHOW_NSFW', subtitle: 'SHOW_NSFW_SUBTITLE' }),
	locked: setting.boolean({
		default: true,
		title: 'SHOW_LOCKED',
		subtitle: 'SHOW_LOCKED_SUBTITLE',
	}),
	rules: setting.boolean({ default: true, title: 'SHOW_RULES', subtitle: 'SHOW_RULES_SUBTITLE' }),
	type: setting.boolean({ default: false, title: 'SHOW_TYPE', subtitle: 'SHOW_TYPE_SUBTITLE' }),
	oneBadge: setting.boolean({
		default: false,
		title: 'ONE_BADGE',
		subtitle: 'ONE_BADGE_SUBTITLE',
	}),
});
