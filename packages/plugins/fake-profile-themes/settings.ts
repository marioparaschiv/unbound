import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	nitroFirst: setting.boolean({
		default: true,
		title: 'NITRO_FIRST',
		subtitle: 'NITRO_FIRST_SUBTITLE',
	}),
	primary: setting.string({ default: '#5865F2', title: 'PRIMARY', displayAs: 'color' }),
	accent: setting.string({ default: '#EB459E', title: 'ACCENT', displayAs: 'color' }),
	copyCode: setting.button({
		title: 'COPY_CODE',
		subtitle: 'COPY_CODE_SUBTITLE',
		action: 'copyBioCode',
	}),
});
