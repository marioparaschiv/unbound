import { Discord } from '@unbound-app/api/metro/components';

import { MAX_AVATARS } from '~/constants';
import { Theme } from '~/modules';

// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		marginLeft: 6,
	},
	unknownAvatar: {
		alignItems: 'center',
		backgroundColor: Theme.colors.BACKGROUND_ACCENT,
		borderRadius: 8,
		height: 16,
		justifyContent: 'center',
		width: 16,
	},
	unknownIcon: {
		color: Theme.colors.TEXT_DEFAULT,
	},
	overflow: {
		marginLeft: -6,
		zIndex: MAX_AVATARS + 1,
	},
	overflowBadge: {
		alignItems: 'center',
		backgroundColor: '#000',
		borderRadius: 8,
		height: 16,
		justifyContent: 'center',
		width: 16,
	},
	overflowText: {
		color: '#fff',
		fontSize: 8,
		fontWeight: '600',
	},
}));
