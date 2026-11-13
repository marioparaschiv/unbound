import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	explain: setting.boolean({ default: true, title: 'EXPLAIN', subtitle: 'EXPLAIN_SUBTITLE' }),
	custom: setting.array({
		title: 'CUSTOM_TAGS',
		subtitle: 'CUSTOM_TAGS_SUBTITLE',
		of: setting.string(),
	}),
});
