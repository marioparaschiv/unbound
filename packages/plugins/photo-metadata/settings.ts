import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	removeLocation: setting.boolean({
		default: true,
		title: 'REMOVE_LOCATION',
		subtitle: 'REMOVE_LOCATION_SUBTITLE',
	}),
	removeAll: setting.boolean({
		default: false,
		title: 'REMOVE_ALL',
		subtitle: 'REMOVE_ALL_SUBTITLE',
	}),
});
