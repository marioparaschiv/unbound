import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	tag: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	label: {
		color: Theme.colors.TEXT_MUTED,
	},
	brandLabel: {
		color: Theme.colors.TEXT_BRAND ?? Theme.colors.TEXT_MUTED,
	},
	newTag: {
		backgroundColor: Theme.colors.STATUS_DANGER ?? '#da373c',
	},
	newLabel: {
		color: Theme.colors.WHITE ?? '#ffffff',
	},
});
