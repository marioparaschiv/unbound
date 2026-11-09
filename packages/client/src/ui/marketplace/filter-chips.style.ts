import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Cancels the header's side padding, so the pills scroll under the screen's edges.
	scroller: {
		marginHorizontal: -16,
	},
	row: {
		gap: 8,
		alignItems: 'center',
		paddingHorizontal: 16,
	},
});
