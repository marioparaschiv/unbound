import LOGO_COLORS from '~/ui/icons/logo-colors';
import { Discord } from '~/metro/components';

/** The shine's size: taller than the banner, so its tilted band crosses it top to bottom. */
export const SHINE_WIDTH = 110;
export const SHINE_HEIGHT = 360;

// The banner is always dark, after the logo, so its text is white in every theme.
export default Discord.createStyles({
	banner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 28,
		paddingHorizontal: 28,
		paddingVertical: 28,
		borderRadius: 22,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.08)',
		overflow: 'hidden',
		backgroundColor: LOGO_COLORS.ink,
	},
	pressed: {
		transform: [{ scale: 0.98 }],
	},
	shine: {
		position: 'absolute',
		top: -110,
		left: 0,
		width: SHINE_WIDTH,
		height: SHINE_HEIGHT,
	},
	// A dark drop shadow lifts the logo off the halo instead of glowing into it.
	logo: {
		shadowColor: '#000000',
		shadowOpacity: 0.7,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 6 },
	},
	text: {
		flex: 1,
		gap: 6,
	},
	title: {
		color: '#FFFFFF',
		letterSpacing: -0.8,
	},
	meta: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	version: {
		color: 'rgba(255, 255, 255, 0.75)',
		letterSpacing: 0.6,
	},
	divider: {
		width: 1,
		height: 10,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
	},
	revision: {
		color: 'rgba(255, 255, 255, 0.4)',
		letterSpacing: 0.5,
	},
});
