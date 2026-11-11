import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// A round button like Discord's header actions, at the row's left edge until the row places it.
	slot: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: 56,
		height: 56,
		borderRadius: Theme.radii.round,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
		alignItems: 'center',
		justifyContent: 'center',
	},
	icon: {
		tintColor: Theme.colors.INTERACTIVE_ICON_DEFAULT,
	},
});
