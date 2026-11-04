import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		attachments: setting.boolean({
			default: true,
			title: 'ATTACHMENTS',
			subtitle: 'ATTACHMENTS_SUBTITLE',
		}),
		embeds: setting.boolean({
			default: true,
			title: 'EMBEDS',
			subtitle: 'EMBEDS_SUBTITLE',
		}),
	},
	{ title: 'BLUR' },
);
