import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

export default Discord.createStyles({
	label: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 0,
		gap: 3,
	},
	// Sized to the line height of the text beside it. Digits sit above the line's centre, which keeps room
	// for descenders, so the icon is raised two points to centre on them.
	cardIcon: {
		width: 14,
		height: 14,
		tintColor: Theme.colors.TEXT_MUTED,
		transform: [{ translateY: -2 }],
	},
	pageIcon: {
		width: 16,
		height: 16,
		tintColor: Theme.colors.TEXT_MUTED,
		transform: [{ translateY: -2 }],
	},
});
