import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	layout: setting.choice({
		default: 'dynamic',
		hidden: true,
		options: { dynamic: 'LAYOUT_FIT', card: 'LAYOUT_CARD' },
	}),
	radius: setting.number({ default: 10, hidden: true }),
	horizontalPadding: setting.number({ default: 8, hidden: true }),
	verticalPadding: setting.number({ default: 4, hidden: true }),
	opacity: setting.number({ default: 40, hidden: true }),
	color: setting.string({ default: '', hidden: true }),
	ownColor: setting.string({ default: '', hidden: true }),
});
