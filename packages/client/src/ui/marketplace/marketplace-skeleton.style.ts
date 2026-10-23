import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

// Shapes and tokens follow Discord's own placeholders (app launcher rows, shop skeleton cards).
export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	header: {
		flexDirection: 'row',
		gap: 12,
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
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 32,
	},
	button: {
		width: 64,
		height: 32,
		borderRadius: Theme.radii.round,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
});
