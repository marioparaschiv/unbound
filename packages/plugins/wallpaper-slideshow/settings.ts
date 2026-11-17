import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	wallpapers: setting.array({
		title: 'WALLPAPERS',
		subtitle: 'WALLPAPERS_SUBTITLE',
		of: setting.string(),
		default: [],
		displayAs: 'list',
	}),
	interval: setting.integer({
		default: 15 * 60_000,
		title: 'INTERVAL',
		subtitle: 'INTERVAL_SUBTITLE',
		displayAs: 'duration',
		units: ['m', 'h'],
		min: 60_000,
	}),
	shuffle: setting.boolean({ default: false, title: 'SHUFFLE', subtitle: 'SHUFFLE_SUBTITLE' }),
	next: setting.button({ title: 'NEXT', action: 'nextWallpaper' }),
	position: setting.integer({ default: 0, hidden: true }),
});
