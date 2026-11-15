import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	coloredOnly: setting.boolean({
		default: false,
		title: 'COLORED_ONLY',
		subtitle: 'COLORED_ONLY_SUBTITLE',
	}),
});
