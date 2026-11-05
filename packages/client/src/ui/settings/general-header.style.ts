import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	header: {
		alignItems: 'center',
		gap: 16,
		paddingTop: 24,
		paddingBottom: 16,
	},
	logo: {
		shadowColor: '#000000',
		shadowOpacity: 0.35,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
	},
	// Handed to the SVG logo, which takes a colour string rather than a style.
	logoTint: {
		color: Theme.colors.MOBILE_TEXT_HEADING_PRIMARY,
	},
	pressed: {
		opacity: 0.6,
	},
});
