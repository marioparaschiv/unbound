import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	// Read as a resolved string for the SVG's `color` prop.
	glyph: {
		color: Theme.colors.TEXT_BRAND,
	},
});
