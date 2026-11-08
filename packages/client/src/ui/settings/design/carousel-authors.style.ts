import { Discord } from '~/metro/components';

export default Discord.createStyles({
	hidden: {
		opacity: 0,
	},
	// Over the hidden caption, so the taller avatar row overflows its line instead of moving the title and preview.
	overlay: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
		alignItems: 'center',
		justifyContent: 'center',
	},
	authors: {
		alignSelf: 'center',
	},
});
