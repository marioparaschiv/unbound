import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		persistState: setting.boolean({
			default: false,
			title: 'PERSIST_STATE',
			subtitle: 'PERSIST_STATE_SUBTITLE',
		}),
		autoDisable: setting.boolean({
			default: false,
			title: 'AUTO_DISABLE',
			subtitle: 'AUTO_DISABLE_SUBTITLE',
		}),
		stutter: setting.boolean({
			default: true,
			title: 'STUTTER',
			subtitle: 'STUTTER_SUBTITLE',
		}),
		faces: setting.boolean({
			default: true,
			title: 'FACES',
			subtitle: 'FACES_SUBTITLE',
		}),
	},
	{ title: 'TOGGLE' },
);
