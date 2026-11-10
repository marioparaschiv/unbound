import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// Discord's own swatch for a base theme: its background inside a 1px strong border on its small radius.
	swatch: {
		width: '100%',
		height: '100%',
		borderRadius: Theme.radii.sm,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		backgroundColor: Theme.colors.BACKGROUND_BASE_LOW,
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	icon: {
		tintColor: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
});
