import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Shapes and tokens follow Discord's own placeholders (app launcher rows, shop skeleton cards).
export default Discord.createStyles({
	list: {
		gap: 12,
	},
	card: {
		gap: 14,
		padding: 16,
	},
	icon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	content: {
		flex: 1,
		gap: 6,
	},
	bar: {
		borderRadius: Theme.radii.lg,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	// Two title lines, then a two-line description, sized like the real card's text.
	titleBar: {
		width: '45%',
		height: 16,
	},
	subtitleBar: {
		width: '25%',
		height: 12,
	},
	descriptionBar: {
		width: '92%',
		height: 14,
		marginTop: 6,
	},
	lastBar: {
		width: '64%',
		height: 14,
	},
	button: {
		width: 64,
		height: 32,
		borderRadius: Theme.radii.round,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
});
