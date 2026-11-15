import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	everyMessage: setting.boolean({
		default: true,
		title: 'EVERY_MESSAGE',
		subtitle: 'EVERY_MESSAGE_SUBTITLE',
	}),
});
