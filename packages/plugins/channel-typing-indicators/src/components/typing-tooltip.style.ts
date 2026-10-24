import { Discord } from '@unbound-app/api/metro/components';

import { Theme } from '~/modules';

// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	backdrop: {
		bottom: 0,
		left: 0,
		position: 'absolute',
		right: 0,
		top: 0,
	},
	arrow: {
		borderBottomColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST,
		borderTopColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST,
	},
	bubble: {
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST,
	},
	label: {
		color: Theme.colors.TEXT_DEFAULT,
	},
}));
