import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		persistState: setting.boolean({
			default: false,
			title: 'PERSIST_STATE',
			subtitle: 'PERSIST_STATE_SUBTITLE',
		}),
		autoDisable: setting.boolean({
			default: true,
			title: 'AUTO_DISABLE',
			subtitle: 'AUTO_DISABLE_SUBTITLE',
		}),
	},
	{ title: 'TOGGLE' },
);
