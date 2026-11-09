import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Mirrors `./marketplace-card.style` and its children's sizes; tokens follow Discord's own placeholders.
export default Discord.createStyles({
	// Fills the tab and clips the cards that run past its bottom edge.
	list: {
		flex: 1,
		gap: 12,
		overflow: 'hidden',
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
	heading: {
		flex: 1,
		minWidth: 0,
		gap: 6,
	},
	bar: {
		borderRadius: Theme.radii.lg,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	titleBar: {
		width: '55%',
		height: 16,
	},
	authorsBar: {
		width: '35%',
		height: 14,
	},
	button: {
		width: 64,
		height: 32,
		borderRadius: Theme.radii.round,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	description: {
		gap: 6,
		marginTop: -6,
	},
	lineBar: {
		width: '92%',
		height: 14,
	},
	lastLineBar: {
		width: '64%',
		height: 14,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: -4,
	},
	pill: {
		height: 20,
		borderRadius: Theme.radii.round,
		backgroundColor: Theme.colors.BACKGROUND_MOD_SUBTLE,
	},
	tagPill: {
		width: 72,
	},
	versionPill: {
		width: 44,
	},
	spacer: {
		flex: 1,
	},
});
