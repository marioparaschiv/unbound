import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	name: {
		flexShrink: 1,
	},
	versionBadge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
});
