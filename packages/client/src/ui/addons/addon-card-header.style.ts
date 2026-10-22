import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	iconContainer: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	content: {
		flex: 1,
		gap: 3,
	},
	description: {
		marginTop: 5,
		lineHeight: 19,
	},
});
