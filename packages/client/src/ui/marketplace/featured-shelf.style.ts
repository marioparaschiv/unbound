import { Discord } from '~/metro/components';

export default Discord.createStyles({
	shelf: {
		gap: 10,
		marginBottom: 8,
	},
	// Cancels the list's side padding, so the cards scroll under the screen's edges.
	scroller: {
		marginHorizontal: -16,
	},
	row: {
		paddingHorizontal: 16,
		paddingBottom: 4,
	},
	// The gap between cards; a virtualised row lays its cells out itself, so `gap` does not apply.
	after: {
		paddingLeft: 10,
	},
});
