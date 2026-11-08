import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// Discord's own swatch for a base theme: a 1px strong border on its small radius.
	swatch: {
		width: '100%',
		height: '100%',
		borderRadius: Theme.radii.sm,
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
		overflow: 'hidden',
	},
	gradient: {
		flex: 1,
	},
});
