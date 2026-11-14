import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	showFavorites: setting.boolean({
		default: true,
		title: 'SHOW_FAVORITES',
		subtitle: 'SHOW_FAVORITES_SUBTITLE',
	}),
	showSettings: setting.boolean({
		default: true,
		title: 'SHOW_SETTINGS',
		subtitle: 'SHOW_SETTINGS_SUBTITLE',
	}),
	localFavorites: setting.boolean({
		default: false,
		title: 'LOCAL_FAVORITES',
		subtitle: 'LOCAL_FAVORITES_SUBTITLE',
	}),
	favorites: setting.string({ default: '', hidden: true }),
});
