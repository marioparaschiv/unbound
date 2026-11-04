import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	greetOnStart: setting.boolean({
		default: true,
		title: 'GREET_ON_START',
		subtitle: 'GREET_ON_START_SUBTITLE',
	}),
});
