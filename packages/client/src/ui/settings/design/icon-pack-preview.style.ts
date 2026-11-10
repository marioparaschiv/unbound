import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	grid: {
		flex: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignContent: 'center',
		justifyContent: 'center',
		gap: 16,
		padding: 16,
	},
	button: {
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
