import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	messages: setting.boolean({
		default: true,
		title: 'SHOW_IN_MESSAGES',
		subtitle: 'SHOW_IN_MESSAGES_SUBTITLE',
	}),
	profiles: setting.boolean({ default: true, title: 'SHOW_IN_PROFILES' }),
	showOwn: setting.boolean({ default: true, title: 'SHOW_OWN' }),
	clock: setting.choice({
		default: 'device',
		title: 'CLOCK',
		options: { device: 'CLOCK_DEVICE', h12: 'CLOCK_12', h24: 'CLOCK_24' },
	}),
	database: setting.boolean({
		default: true,
		title: 'USE_DATABASE',
		subtitle: 'USE_DATABASE_SUBTITLE',
	}),
	chosen: setting.array({ of: setting.string(), hidden: true }),
	discordClock: setting.choice({
		default: 'unknown',
		hidden: true,
		options: { unknown: 'CLOCK_DEVICE', h12: 'CLOCK_12', h24: 'CLOCK_24' },
	}),
});
