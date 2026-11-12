import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

const AVATAR_SIZE = 28;

// A factory, so the theme is read when the preview renders rather than when the plugin loads.
export default Discord.createStyles(() => ({
	preview: {
		backgroundColor:
			metro.common.Theme.colors.CHANNEL_BACKGROUND_DEFAULT ??
			metro.common.Theme.colors.BACKGROUND_BASE_LOWER,
		borderBottomColor: metro.common.Theme.colors.BORDER_SUBTLE,
		borderBottomWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	row: {
		flexDirection: 'row',
	},
	column: {
		flex: 1,
	},
	avatar: {
		alignItems: 'center',
		borderRadius: AVATAR_SIZE / 2,
		height: AVATAR_SIZE,
		justifyContent: 'center',
		width: AVATAR_SIZE,
	},
	avatarSlot: {
		marginRight: 8,
		width: AVATAR_SIZE,
	},
	avatarLast: {
		alignSelf: 'flex-end',
	},
	initial: {
		color: 'white',
		fontWeight: '700',
	},
	name: {
		marginBottom: 2,
	},
	content: {
		alignSelf: 'flex-start',
	},
	bubble: {
		alignSelf: 'flex-start',
	},
	card: {
		alignSelf: 'stretch',
	},
	shape: {
		left: 0,
		position: 'absolute',
		top: 0,
	},
	mention: {
		backgroundColor: 'rgba(88, 101, 242, 0.3)',
		color: '#C9CDFB',
		fontWeight: '600',
	},
}));
