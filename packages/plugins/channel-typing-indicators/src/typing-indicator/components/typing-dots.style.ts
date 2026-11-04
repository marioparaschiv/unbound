import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		height: 16,
		marginLeft: 6,
	},
	dot: {
		backgroundColor: metro.common.Theme.colors.TEXT_MUTED,
		borderRadius: 3,
		height: 6,
		width: 6,
	},
}));
