import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	replace: setting.boolean({ default: true, title: 'REPLACE', subtitle: 'REPLACE_SUBTITLE' }),
	pickerButton: setting.boolean({
		default: true,
		title: 'PICKER_SETTING',
		subtitle: 'PICKER_SETTING_SUBTITLE',
	}),
});
