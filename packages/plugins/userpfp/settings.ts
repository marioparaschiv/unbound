import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	nitroFirst: setting.boolean({
		default: true,
		title: 'NITRO_FIRST',
		subtitle: 'NITRO_FIRST_SUBTITLE',
	}),
});
