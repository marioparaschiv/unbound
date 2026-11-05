import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	list: {
		flexGrow: 1,
		padding: 16,
		gap: 12,
	},
	// Read as a resolved colour for the refresh control's `tintColor` prop.
	spinner: {
		color: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
});
