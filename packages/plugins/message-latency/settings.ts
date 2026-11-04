import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		latency: setting.integer({
			default: 2,
			min: 1,
			max: 10,
			title: 'LATENCY_THRESHOLD',
			subtitle: 'LATENCY_THRESHOLD_SUBTITLE',
		}),
		showMillis: setting.boolean({
			default: false,
			title: 'SHOW_MILLISECONDS',
			subtitle: 'SHOW_MILLISECONDS_SUBTITLE',
		}),
		ignoreSelf: setting.boolean({
			default: false,
			title: 'IGNORE_MY_MESSAGES',
			subtitle: 'IGNORE_MY_MESSAGES_SUBTITLE',
		}),
		detectDiscordKotlin: setting.boolean({
			default: true,
			title: 'DETECT_LEGACY_ANDROID',
			subtitle: 'DETECT_LEGACY_ANDROID_SUBTITLE',
		}),
	},
	{ title: 'INDICATOR' },
);
