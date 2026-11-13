import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	showButton: setting.boolean({
		default: true,
		title: 'SHOW_BUTTON',
		subtitle: 'SHOW_BUTTON_SUBTITLE',
	}),
});
