import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		persistState: setting.boolean({
			default: true,
			title: 'PERSIST_STATE',
			subtitle: 'PERSIST_STATE_SUBTITLE',
		}),
		autoDisable: setting.boolean({
			default: false,
			title: 'AUTO_DISABLE',
			subtitle: 'AUTO_DISABLE_SUBTITLE',
		}),
	},
	{ title: 'TOGGLE' },
);
