import { Discord } from '~/metro/components';
import { Radius } from '~/metro/common';

export default Discord.createStyles({
	// Rounded as the table row groups below it.
	card: {
		borderRadius: Radius.Radius.lg,
		padding: 16,
		gap: 12,
	},
	line: {
		gap: 2,
	},
});
