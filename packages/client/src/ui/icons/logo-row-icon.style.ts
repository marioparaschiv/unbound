import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

/** Discord's settings row icons are 24 points square. */
export const ROW_ICON_SIZE = 24;

export default Discord.createStyles({
	icon: {
		width: ROW_ICON_SIZE,
		height: ROW_ICON_SIZE,
		alignItems: 'center',
		justifyContent: 'center',
	},
	// Read as a resolved string for the logo SVG's `color` prop.
	logo: {
		color: Theme.colors.TABLEROW_ICON_COLOR_DEFAULT,
	},
});
