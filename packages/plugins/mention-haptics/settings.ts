import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	strength: setting.choice({
		default: 'medium',
		title: 'STRENGTH',
		options: { light: 'STRENGTH_LIGHT', medium: 'STRENGTH_MEDIUM', heavy: 'STRENGTH_HEAVY' },
	}),
	directMessages: setting.boolean({
		default: true,
		title: 'DIRECT_MESSAGES',
		subtitle: 'DIRECT_MESSAGES_SUBTITLE',
	}),
	openChannel: setting.boolean({
		default: false,
		title: 'OPEN_CHANNEL',
		subtitle: 'OPEN_CHANNEL_SUBTITLE',
	}),
});
