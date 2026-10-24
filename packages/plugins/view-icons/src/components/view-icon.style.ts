import { Discord } from '@unbound-app/api/metro/components';

import { Theme } from '~/modules';

// A factory, so the theme is read when a menu renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	icon: {
		color: Theme.colors.TEXT_DEFAULT,
	},
}));
