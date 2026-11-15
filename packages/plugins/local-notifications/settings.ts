import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	mode: setting.choice({
		default: 'auto',
		title: 'MODE',
		subtitle: 'MODE_SUBTITLE',
		options: { auto: 'MODE_AUTO', always: 'MODE_ALWAYS' },
	}),
	directMessages: setting.boolean({
		default: true,
		title: 'DIRECT_MESSAGES',
		subtitle: 'DIRECT_MESSAGES_SUBTITLE',
	}),
	preview: setting.boolean({ default: true, title: 'PREVIEW', subtitle: 'PREVIEW_SUBTITLE' }),
});
