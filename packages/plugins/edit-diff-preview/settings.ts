import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	minLength: setting.integer({
		default: 200,
		min: 0,
		max: 2000,
		title: 'MIN_LENGTH',
		subtitle: 'MIN_LENGTH_SUBTITLE',
	}),
	code: setting.boolean({ default: true, title: 'CODE', subtitle: 'CODE_SUBTITLE' }),
});
