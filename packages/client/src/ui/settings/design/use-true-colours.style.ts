import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// Undimmed, a swatch can match the page behind it; Discord's own swatch keeps its edge with this border.
	swatch: {
		borderWidth: 1,
		borderColor: Theme.colors.BORDER_STRONG,
	},
});
