import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sendAs: setting.choice({
		title: 'SEND_AS',
		subtitle: 'SEND_AS_SUBTITLE',
		default: 'ask',
		options: {
			ask: { title: 'ASK' },
			still: { title: 'STILL' },
			video: { title: 'VIDEO' },
			gif: { title: 'GIF' },
		},
	}),
});
