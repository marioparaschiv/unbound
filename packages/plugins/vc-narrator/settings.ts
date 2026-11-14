import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	announce: setting.section(
		{ title: 'ANNOUNCE' },
		{
			joins: setting.boolean({ default: true, title: 'JOINS', subtitle: 'JOINS_SUBTITLE' }),
			leaves: setting.boolean({
				default: true,
				title: 'LEAVES',
				subtitle: 'LEAVES_SUBTITLE',
			}),
			moves: setting.boolean({ default: true, title: 'MOVES', subtitle: 'MOVES_SUBTITLE' }),
			yourself: setting.boolean({
				default: true,
				title: 'YOURSELF',
				subtitle: 'YOURSELF_SUBTITLE',
			}),
		},
	),
	voice: setting.section(
		{ title: 'VOICE' },
		{
			rate: setting.choice({
				default: 'normal',
				title: 'SPEECH_RATE',
				displayAs: 'segmented',
				options: { slow: 'RATE_SLOW', normal: 'RATE_NORMAL', fast: 'RATE_FAST' },
			}),
		},
	),
});
