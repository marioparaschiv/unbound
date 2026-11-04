import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

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
		borderBottomColor: metro.common.Theme.colors.BACKGROUND_SURFACE_HIGHEST,
		borderTopColor: metro.common.Theme.colors.BACKGROUND_SURFACE_HIGHEST,
	},
	bubble: {
		backgroundColor: metro.common.Theme.colors.BACKGROUND_SURFACE_HIGHEST,
	},
	label: {
		color: metro.common.Theme.colors.TEXT_DEFAULT,
	},
}));
