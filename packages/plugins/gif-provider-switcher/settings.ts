import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	provider: setting.choice({
		default: 'tenor',
		title: 'PROVIDER',
		options: {
			tenor: { title: 'PROVIDER_TENOR', subtitle: 'PROVIDER_TENOR_SUBTITLE' },
			giphy: { title: 'PROVIDER_GIPHY', subtitle: 'PROVIDER_GIPHY_SUBTITLE' },
			klipy: { title: 'PROVIDER_KLIPY', subtitle: 'PROVIDER_KLIPY_SUBTITLE' },
		},
	}),
});
