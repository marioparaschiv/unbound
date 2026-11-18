import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	album: setting.string({
		default: 'Discord',
		title: 'ALBUM',
		subtitle: 'ALBUM_SUBTITLE',
		maxLength: 64,
	}),
});
