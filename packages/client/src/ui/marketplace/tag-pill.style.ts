import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Mirrors `~/ui/components/addon-tag.style`, so tags sit beside the version pill as one set.
export default Discord.createStyles({
	pill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	label: {
		color: Theme.colors.TEXT_MUTED,
	},
});
