import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	autoCollapse: setting.boolean({
		default: true,
		title: 'AUTO_COLLAPSE',
		subtitle: 'AUTO_COLLAPSE_SUBTITLE',
	}),
	hideIcons: setting.boolean({
		default: false,
		title: 'HIDE_ICONS',
		subtitle: 'HIDE_ICONS_SUBTITLE',
	}),
});
