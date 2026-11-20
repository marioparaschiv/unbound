import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	vision: setting.choice({
		default: 'deuteranopia',
		title: 'VISION',
		options: {
			protanopia: 'VISION_PROTANOPIA',
			deuteranopia: 'VISION_DEUTERANOPIA',
			tritanopia: 'VISION_TRITANOPIA',
		},
	}),
	strength: setting.integer({
		default: 100,
		min: 0,
		max: 100,
		step: 10,
		title: 'STRENGTH',
		subtitle: 'STRENGTH_SUBTITLE',
	}),
	mentions: setting.boolean({
		default: true,
		title: 'MENTIONS',
		subtitle: 'MENTIONS_SUBTITLE',
	}),
});
