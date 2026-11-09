import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	fade: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		width: 28,
	},
	// Read as a resolved string for the gradient's stops: a primary `Card`'s background.
	card: {
		color: Theme.colors.CARD_BACKGROUND_DEFAULT,
	},
	start: {
		left: 0,
	},
	end: {
		right: 0,
	},
	hidden: {
		opacity: 0,
	},
});
