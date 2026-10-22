import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

// Background colours only render on device when they come through createStyles, not inline.
export default Discord.createStyles({
	button: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Theme.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
		borderColor: Theme.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
	},
	pressed: {
		backgroundColor: Theme.colors.CONTROL_SECONDARY_BACKGROUND_ACTIVE,
		borderColor: Theme.colors.CONTROL_SECONDARY_BORDER_ACTIVE,
	},
	disabled: {
		opacity: 0.4,
	},
});
