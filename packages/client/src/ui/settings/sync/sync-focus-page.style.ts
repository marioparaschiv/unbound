import { Discord } from '~/metro/components';

export default Discord.createStyles({
	// Grows to the screen's height so the footer can sit at its bottom edge.
	scroll: {
		flexGrow: 1,
		padding: 16,
	},
	fill: {
		flex: 1,
		gap: 24,
	},
	middle: {
		flex: 1,
		justifyContent: 'center',
	},
});
