import { Discord } from '~/metro/design';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	badge: {
		flexShrink: 1,
		minWidth: 0,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	brand: {
		backgroundColor: Theme.colors.BACKGROUND_BRAND,
	},
	label: {
		textTransform: 'uppercase',
		color: Theme.colors.TEXT_MUTED,
	},
	brandLabel: {
		color: Theme.colors.WHITE,
	},
});
