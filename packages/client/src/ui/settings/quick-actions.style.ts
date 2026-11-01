import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	row: {
		flexDirection: 'row',
		gap: 8,
	},
	tile: {
		flex: 1,
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 14,
		borderRadius: 16,
		backgroundColor: Theme.colors.TABLEROW_BACKGROUND_DEFAULT,
	},
	// The same surfaces as Discord's table rows, so the tiles sit beside the groups below.
	pressed: {
		backgroundColor: Theme.colors.TABLEROW_BACKGROUND_PRESSED,
	},
});
