import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

/** Every gallery entry's height; its width follows the entry's aspect ratio. */
export const GALLERY_HEIGHT = 200;

export default Discord.createStyles({
	row: {
		gap: 8,
		paddingHorizontal: 16,
	},
	thumbnail: {
		height: GALLERY_HEIGHT,
		overflow: 'hidden',
		borderRadius: Theme.radii.lg,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	fill: {
		width: '100%',
		height: '100%',
	},
	badgeFrame: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		alignItems: 'center',
		justifyContent: 'center',
	},
	badge: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
	},
	badgeIcon: {
		tintColor: Theme.colors.WHITE,
	},
});
