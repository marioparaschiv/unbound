import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

// A factory, so the theme is read when a sheet or menu renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	icon: {
		color: metro.common.Theme.colors.TEXT_DEFAULT,
	},
}));
