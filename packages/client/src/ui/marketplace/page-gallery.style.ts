import { Discord } from '~/metro/components';

/** Every gallery entry's height; its width follows the entry's aspect ratio. */
export const GALLERY_HEIGHT = 200;

export default Discord.createStyles({
	row: {
		gap: 8,
		paddingHorizontal: 16,
	},
	media: {
		height: GALLERY_HEIGHT,
	},
});
