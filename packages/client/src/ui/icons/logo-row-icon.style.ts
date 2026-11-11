import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

/** Discord's settings row icons are 24 points square. */
export const ROW_ICON_SIZE = 24;

export default Discord.createStyles({
	icon: {
		width: ROW_ICON_SIZE,
		height: ROW_ICON_SIZE,
	},
	layer: {
		position: 'absolute',
		width: ROW_ICON_SIZE,
		height: ROW_ICON_SIZE,
	},
	body: {
		position: 'absolute',
		width: ROW_ICON_SIZE,
		height: ROW_ICON_SIZE,
		tintColor: Theme.colors.TABLEROW_ICON_COLOR_DEFAULT,
	},
});
