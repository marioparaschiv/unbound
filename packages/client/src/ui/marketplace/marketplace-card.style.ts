import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

// Mirrors the installed addon card (`~/ui/addons/addon-card.style`), so both pages read alike.
export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	heading: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	bottom: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 12,
		marginTop: -8,
	},
	description: {
		flex: 1,
		minWidth: 0,
		alignSelf: 'flex-start',
		lineHeight: 19,
		color: Theme.colors.TEXT_DEFAULT,
	},
	spacer: {
		flex: 1,
	},
	// With tags, the description spans the card and the footer below holds the tags and version.
	above: {
		flex: 0,
		marginTop: -8,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: -4,
	},
});
