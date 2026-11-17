import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	pack: setting.choice({
		default: 'fluent-animated',
		title: 'PACK',
		subtitle: 'PACK_SUBTITLE',
		displayAs: 'radio',
		options: {
			'fluent-animated': { title: 'FLUENT_ANIMATED', subtitle: 'FLUENT_ANIMATED_SUBTITLE' },
			fluent: { title: 'FLUENT', subtitle: 'FLUENT_SUBTITLE' },
			'noto-animated': { title: 'NOTO_ANIMATED', subtitle: 'NOTO_ANIMATED_SUBTITLE' },
			noto: { title: 'NOTO', subtitle: 'NOTO_SUBTITLE' },
		},
	}),
});
