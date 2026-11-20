import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		gained: setting.boolean({ default: true, title: 'GAINED', subtitle: 'GAINED_SUBTITLE' }),
		lost: setting.boolean({ default: true, title: 'LOST', subtitle: 'LOST_SUBTITLE' }),
		notices: setting.boolean({
			default: false,
			title: 'NOTICES',
			subtitle: 'NOTICES_SUBTITLE',
		}),
	},
	{ title: 'NOTIFY_WHEN' },
);
