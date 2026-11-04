import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sortOrder: setting.choice({
		default: 'highest',
		title: 'SORT_ORDER',
		options: {
			highest: { title: 'SORT_HIGHEST', subtitle: 'SORT_HIGHEST_SUBTITLE' },
			lowest: { title: 'SORT_LOWEST', subtitle: 'SORT_LOWEST_SUBTITLE' },
		},
	}),
	rolesCardButton: setting.boolean({
		default: true,
		title: 'ROLES_CARD_BUTTON',
		subtitle: 'ROLES_CARD_BUTTON_SUBTITLE',
	}),
});
