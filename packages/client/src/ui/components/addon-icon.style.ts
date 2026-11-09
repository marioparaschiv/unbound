import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	tile: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	large: {
		width: 64,
		height: 64,
		borderRadius: 18,
	},
	// Read as a resolved string for the SVG's `color` prop.
	glyph: {
		color: Theme.colors.TEXT_STRONG,
	},
});
