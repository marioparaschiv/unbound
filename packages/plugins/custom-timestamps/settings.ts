import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	today: setting.string({
		default: 'HH:mm',
		title: 'TODAY',
		subtitle: 'TODAY_SUBTITLE',
		maxLength: 64,
	}),
	older: setting.string({
		default: 'DD/MM/YYYY HH:mm',
		title: 'OLDER',
		subtitle: 'OLDER_SUBTITLE',
		maxLength: 64,
	}),
});
