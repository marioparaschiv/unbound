import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	top: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	heading: {
		flex: 1,
		gap: 2,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	bottom: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
		marginTop: -8,
	},
	description: {
		flex: 1,
		alignSelf: 'flex-start',
		lineHeight: 19,
	},
	spacer: {
		flex: 1,
	},
	version: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	failed: {
		opacity: 0.5,
	},
	error: {
		marginTop: 4,
	},
});
